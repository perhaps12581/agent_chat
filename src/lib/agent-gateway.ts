import { WebSocket, WebSocketServer } from "ws";
import { IncomingMessage } from "http";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";

// 消息信封通用结构 (v1.1 标准)
export interface AgentEnvelope {
  msgId?: string;
  type: string;
  taskId?: string;
  seq?: number;
  ts?: number;
  capabilities?: string[];
  pendingTaskIds?: string[];
  status?: string;
  reason?: string;
  step?: string;
  message?: string;
  progress?: number;
  result?: string;
  artifacts?: Prisma.InputJsonValue;
  error?: { code?: string; message?: string } | null;
  prompt?: string;
  isRef?: boolean;
  payloadRefUrl?: string;
  priority?: number;
  payload?: unknown;
  [key: string]: unknown;
}

interface AgentSession {
  agentId: string;
  ws: WebSocket;
  lastHeartbeat: number;
  isReady: boolean;
  capabilities: string[];
}

export class AgentGateway {
  private static instance: AgentGateway;
  // agentId -> Session 映射
  private activeSessions = new Map<string, AgentSession>();
  // 消息事件广播监听器（用于向前端推流）
  private eventListeners = new Set<(event: Record<string, unknown>) => void>();

  public static getInstance(): AgentGateway {
    const globalAny = globalThis as unknown as { __agentGatewayInstance?: AgentGateway };
    if (!globalAny.__agentGatewayInstance) {
      globalAny.__agentGatewayInstance = new AgentGateway();
    }
    return globalAny.__agentGatewayInstance;
  }

  // 绑定 WebSocketServer
  public setupWebSocketServer(wss: WebSocketServer) {
    wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
      await this.handleConnection(ws, req);
    });

    // 启动定时器：清理 60 秒无心跳的僵尸连接
    setInterval(() => {
      const now = Date.now();
      for (const [agentId, session] of this.activeSessions.entries()) {
        if (now - session.lastHeartbeat > 60000) {
          console.warn(`[Gateway] Agent ${agentId} 心跳超时 (60s)，主动释放连接`);
          session.ws.terminate();
          this.activeSessions.delete(agentId);
          this.updateAgentStatus(agentId, "OFFLINE");
        }
      }
    }, 15000);
  }

  // 处理新连接与鉴权
  private async handleConnection(ws: WebSocket, req: IncomingMessage) {
    const authHeader = req.headers["authorization"] || "";
    const agentIdHeader = (req.headers["x-agent-id"] || req.headers["X-Agent-Id"]) as string;

    // 解析 Bearer token
    let token = "";
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }

    if (!agentIdHeader || !token) {
      console.warn(`[Gateway] 握手失败: 缺少 token 或 x-agent-id`);
      ws.close(4401, "Unauthorized");
      return;
    }

    const agentId = agentIdHeader.toLowerCase();

    // 缓存先到达的消息
    const earlyMessages: (Buffer | string)[] = [];
    const earlyHandler = (data: Buffer | string) => {
      earlyMessages.push(data);
    };
    ws.on("message", earlyHandler);

    // 数据库校验 Token
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.token !== token) {
      console.warn(`[Gateway] 握手失败: Agent ${agentId} 认证未通过`);
      ws.close(4401, "Unauthorized");
      return;
    }

    // 7.8 裁定：新连接踢旧连接（4409）
    const existing = this.activeSessions.get(agentId);
    if (existing && existing.ws.readyState === WebSocket.OPEN) {
      console.log(`[Gateway] Agent ${agentId} 存在已有连接，新连接踢旧连接 (关闭码 4409)`);
      existing.ws.close(4409, "Conflict: Replaced by new connection");
    }

    const session: AgentSession = {
      agentId,
      ws,
      lastHeartbeat: Date.now(),
      isReady: false,
      capabilities: [],
    };
    this.activeSessions.set(agentId, session);

    console.log(`[Gateway] Agent ${agentId} 握手成功，等待 AGENT_READY`);

    // 移除临时监听器，绑定正式监听器
    ws.off("message", earlyHandler);

    const onMessage = async (raw: Buffer | string) => {
      try {
        const text = raw.toString();
        const data: AgentEnvelope = JSON.parse(text);
        session.lastHeartbeat = Date.now();
        await this.handleMessage(session, data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Gateway] 消息解析异常:`, message);
      }
    };

    ws.on("message", onMessage);

    // 回放先到达的消息
    for (const msg of earlyMessages) {
      await onMessage(msg);
    }

    ws.on("close", (code: number, reason: Buffer) => {
      console.log(`[Gateway] Agent ${agentId} 连接断开 (code: ${code}, reason: ${reason.toString()})`);
      if (this.activeSessions.get(agentId)?.ws === ws) {
        this.activeSessions.delete(agentId);
        this.updateAgentStatus(agentId, "OFFLINE");
      }
    });

    ws.on("error", (err: Error) => {
      console.error(`[Gateway] Agent ${agentId} 套接字错误:`, err.message);
    });
  }

  // 消息路由处理
  private async handleMessage(session: AgentSession, msg: AgentEnvelope) {
    const { agentId } = session;

    switch (msg.type) {
      // 1. 应用层心跳
      case "PING":
        this.send(session.ws, { type: "PONG", ts: Date.now() });
        break;

      // 2. 上线就绪报文
      case "AGENT_READY": {
        session.isReady = true;
        session.capabilities = msg.capabilities || [];
        console.log(`[Gateway] 收到 Agent ${agentId} 的 AGENT_READY`);

        // 7.7 回复 PLATFORM_HELLO 协商参数
        this.send(session.ws, {
          type: "PLATFORM_HELLO",
          serverTime: Date.now(),
          heartbeatIntervalSec: 30,
          maxMessageBytes: 262144, // 256KB
          protocolVersion: "1.0",
        });

        await this.updateAgentStatus(agentId, "ONLINE", msg.capabilities);

        // 7.3 断线补偿：补发未落盘任务
        const pendingTaskIds: string[] = msg.pendingTaskIds || [];
        await this.compensateUndeliveredTasks(session, pendingTaskIds);
        break;
      }

      // 3. 任务接收回执 (TASK_ACK)
      case "TASK_ACK": {
        const { taskId, status, reason } = msg;
        console.log(`[Gateway] 收到 TASK_ACK: task=${taskId}, status=${status}, reason=${reason || "none"}`);
        if (taskId) {
          await prisma.task.update({
            where: { taskId },
            data: {
              status: status === "ACCEPTED" ? "ACCEPTED" : status === "REJECTED" ? "REJECTED" : "RUNNING",
              lastStep: status || undefined,
            },
          });
          this.broadcastEvent({ type: "TASK_ACK", taskId, agentId: session.agentId, status, reason });
        }
        break;
      }

      // 4. 步骤进度上报 (TASK_PROGRESS)
      case "TASK_PROGRESS": {
        const { taskId, msgId, seq, step, message, progress } = msg;
        console.log(`[Gateway] 进度更新 [${step}] task=${taskId}: ${message}`);

        // 7.1 回执 PLATFORM_RECEIPT
        this.send(session.ws, {
          type: "PLATFORM_RECEIPT",
          taskId,
          ackMsgId: msgId,
          seq,
          ts: Date.now(),
        });

        if (taskId) {
          // 更新 Task 记录
          await prisma.task.update({
            where: { taskId },
            data: {
              status: "RUNNING",
              lastStep: step || undefined,
              progress: typeof progress === "number" ? progress : undefined,
              lastAckMsgId: msgId,
            },
          });

          // 同步更新关联的群聊消息卡片
          await prisma.message.updateMany({
            where: { taskId },
            data: {
              step: step || undefined,
              progress: typeof progress === "number" ? progress : undefined,
              status: "PROCESSING",
            },
          });

          this.broadcastEvent({ type: "TASK_PROGRESS", taskId, agentId: session.agentId, step, message, progress });
        }
        break;
      }

      // 5. 任务完成上报 (TASK_COMPLETE)
      case "TASK_COMPLETE": {
        const { taskId, msgId, seq, status, result, artifacts, error } = msg;
        console.log(`[Gateway] 任务完成: task=${taskId}, status=${status}`);

        // 7.1 回执 PLATFORM_RECEIPT
        this.send(session.ws, {
          type: "PLATFORM_RECEIPT",
          taskId,
          ackMsgId: msgId,
          seq,
          ts: Date.now(),
        });

        if (taskId) {
          const finalStatus = status === "SUCCEEDED" ? "COMPLETED" : status || "COMPLETED";

          await prisma.task.update({
            where: { taskId },
            data: {
              status: finalStatus,
              result: result || "",
              artifacts: artifacts !== undefined ? artifacts : undefined,
              error: error ? (error as Prisma.InputJsonValue) : undefined,
              progress: 100,
              lastAckMsgId: msgId,
            },
          });

          // 更新群聊消息内容为最终生成结果
          await prisma.message.updateMany({
            where: { taskId },
            data: {
              content: result || (error?.message ? `[错误] ${error.message}` : "任务处理完成"),
              status: finalStatus === "COMPLETED" ? "DONE" : "FAILED",
              progress: 100,
            },
          });

          this.broadcastEvent({ type: "TASK_COMPLETE", taskId, agentId: session.agentId, status: finalStatus, result, artifacts });
        }
        break;
      }

      default:
        console.log(`[Gateway] 未识别报文类型:`, msg.type);
    }
  }

  // 派发任务给指定的 Agent
  public async dispatchTask(agentId: string, task: { taskId: string; prompt: string; payload?: unknown; priority?: number }) {
    const session = this.activeSessions.get(agentId.toLowerCase());
    if (!session || session.ws.readyState !== WebSocket.OPEN) {
      console.warn(`[Gateway] 派发失败: Agent ${agentId} 当前不在线，任务将保留在数据库队列`);
      return false;
    }

    const payloadStr = JSON.stringify(task.payload || {});
    const isOverSize = Buffer.byteLength(payloadStr, "utf-8") > 256 * 1024; // 256KB

    let dispatchEnvelope: AgentEnvelope;

    if (isOverSize) {
      // 7.4 超限使用信标
      dispatchEnvelope = {
        type: "TASK_DISPATCH",
        taskId: task.taskId,
        priority: task.priority || 0,
        prompt: task.prompt,
        isRef: true,
        payloadRefUrl: `/api/v1/agent/tasks/${task.taskId}/payload`,
        ts: Date.now(),
      };
    } else {
      dispatchEnvelope = {
        type: "TASK_DISPATCH",
        taskId: task.taskId,
        priority: task.priority || 0,
        prompt: task.prompt,
        payload: task.payload || {},
        ts: Date.now(),
      };
    }

    this.send(session.ws, dispatchEnvelope);
    this.broadcastEvent({ type: "TASK_DISPATCH", taskId: task.taskId, agentId, prompt: task.prompt });
    console.log(`[Gateway] 已向 Agent ${agentId} 下发任务 ${task.taskId}`);
    return true;
  }

  // 补偿重发未落盘任务
  private async compensateUndeliveredTasks(session: AgentSession, pendingTaskIds: string[]) {
    const unAckedTasks = await prisma.task.findMany({
      where: {
        agentId: session.agentId,
        status: { in: ["PENDING"] },
        taskId: { notIn: pendingTaskIds },
      },
      orderBy: { priority: "desc" },
    });

    if (unAckedTasks.length > 0) {
      console.log(`[Gateway] 为 Agent ${session.agentId} 补偿重发 ${unAckedTasks.length} 个任务`);
      for (const t of unAckedTasks) {
        await this.dispatchTask(session.agentId, {
          taskId: t.taskId,
          prompt: t.prompt,
          payload: t.payload,
          priority: t.priority,
        });
      }
    }
  }

  // 更新 Agent 数据库状态
  private async updateAgentStatus(agentId: string, status: string, capabilities?: string[]) {
    try {
      await prisma.agent.update({
        where: { id: agentId },
        data: {
          status,
          capabilities: capabilities || undefined,
          lastHeartbeatAt: new Date(),
        },
      });
      this.broadcastEvent({ type: "AGENT_STATUS_CHANGE", agentId, status });
    } catch {
      // 容错
    }
  }

  // 发送消息封装
  private send(ws: WebSocket, obj: unknown) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  // 注册全局事件监听器
  public onEvent(callback: (event: Record<string, unknown>) => void) {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  private broadcastEvent(event: Record<string, unknown>) {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // 忽略监听器异常
      }
    }
  }

  // 查询当前在线的 Agent
  public getOnlineAgents() {
    return Array.from(this.activeSessions.keys());
  }

  // 主动断开并清理 Agent 连接
  public disconnectAgent(agentId: string, reason = "Agent unregistered") {
    const key = agentId.toLowerCase();
    const session = this.activeSessions.get(key);
    if (session) {
      try {
        session.ws.close(4000, reason);
      } catch {
        // 忽略关闭连接异常
      }
      this.activeSessions.delete(key);
      this.broadcastEvent({ type: "AGENT_STATUS_CHANGE", agentId: key, status: "OFFLINE" });
    }
  }

  // 公共广播事件
  public broadcast(event: Record<string, unknown>) {
    this.broadcastEvent(event);
  }
}
