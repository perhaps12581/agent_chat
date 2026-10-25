import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { prisma } from "./db";
import { AgentGateway } from "./agent-gateway";
import { cacheDel, CacheKeys } from "./redis";

export const GEMINI_AGENT_ID = "gemini";

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface DispatchedSubTask {
  taskId: string;
  agentId: string;
  agentName: string;
  prompt: string;
  deliveredOnline: boolean;
  agentMessageId: string;
}

/**
 * 动态读取本地 .env 文件中的配置项（解决 dev 热重载不刷新 process.env 的问题）
 */
function readEnvFileVar(key: string): string | undefined {
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(new RegExp(`^\\s*${key}\\s*=\\s*["']?([^"'\\r\\n]+)["']?`, "m"));
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  } catch {
    // 忽略读取错误
  }
  return undefined;
}

/**
 * 多级解析 Gemini 配置（环境变量 -> .env 文件 -> 数据库 gemini 节点 token 字段）
 */
export async function resolveGeminiConfig(): Promise<{
  baseUrl: string;
  apiKey: string;
  model: string;
}> {
  const baseUrl = (
    process.env.GEMINI_API_BASE_URL ||
    readEnvFileVar("GEMINI_API_BASE_URL") ||
    "http://101.43.53.182/cli-proxy/v1"
  ).replace(/\/+$/, "");

  const model =
    process.env.GEMINI_MODEL ||
    readEnvFileVar("GEMINI_MODEL") ||
    "gemini-4-argon-high";

  let apiKey =
    process.env.GEMINI_API_KEY ||
    readEnvFileVar("GEMINI_API_KEY") ||
    "";

  // 如果环境变量和 .env 都没有，从数据库 gemini 节点的 token 字段读取
  if (!apiKey || apiKey === "internal_gemini_orchestrator_token") {
    const dbAgent = await prisma.agent.findUnique({
      where: { id: GEMINI_AGENT_ID },
      select: { token: true },
    });
    if (dbAgent?.token && dbAgent.token !== "internal_gemini_orchestrator_token") {
      apiKey = dbAgent.token.trim();
    }
  }

  return { baseUrl, apiKey, model };
}

/**
 * 判断是否启用了内置 Gemini 总控模型
 */
export function isGeminiConfigured(): boolean {
  return true;
}

/**
 * 确保数据库中存在 gemini 总控节点记录
 */
export async function ensureGeminiAgent() {
  const envKey = process.env.GEMINI_API_KEY || readEnvFileVar("GEMINI_API_KEY");

  await prisma.agent.upsert({
    where: { id: GEMINI_AGENT_ID },
    update: envKey ? { token: envKey, status: "ONLINE" } : { status: "ONLINE" },
    create: {
      id: GEMINI_AGENT_ID,
      name: "Gemini 总控中枢",
      description: "全局任务统筹与智能分发大脑，自动理解需求并指派给各台 Muse 设备执行",
      avatar: "bottts_alpha",
      token: envKey || "internal_gemini_orchestrator_token",
      status: "ONLINE",
      capabilities: ["orchestrator", "task_dispatch", "cluster_monitor"],
    },
  });
}

/**
 * 执行 Gemini 总控对话与自动工具调用派发
 */
export async function runGeminiOrchestrator(params: {
  conversationId: string;
  userPrompt: string;
  geminiMessageId: string;
  defaultPriority?: number;
}) {
  const { conversationId, userPrompt, geminiMessageId, defaultPriority = 0 } = params;

  const { baseUrl, apiKey, model } = await resolveGeminiConfig();

  const gateway = AgentGateway.getInstance();

  const updateGeminiStatus = async (step: string, progress: number, content?: string) => {
    await prisma.message.update({
      where: { id: geminiMessageId },
      data: {
        step,
        progress,
        ...(content ? { content } : {}),
        status: "PROCESSING",
      },
    });
    gateway.broadcast({
      type: "TASK_PROGRESS",
      taskId: `gemini_${geminiMessageId}`,
      messageId: geminiMessageId,
      agentId: GEMINI_AGENT_ID,
      step,
      progress,
      message: content,
    });
  };

  try {
    await updateGeminiStatus("ANALYZING", 25, "正在分析需求并检索可用 Muse 节点...");

    // 1. 获取当前所有 Muse 智能体节点及在线状态、活跃任务
    const allAgents = await prisma.agent.findMany({
      where: { id: { not: GEMINI_AGENT_ID } },
      orderBy: { createdAt: "asc" },
    });
    const onlineIds = gateway.getOnlineAgents();

    const activeTasks = await prisma.task.findMany({
      where: { status: { in: ["PENDING", "ACCEPTED", "RUNNING"] } },
      orderBy: { updatedAt: "desc" },
    });

    const clusterInfo = allAgents.map((ag) => {
      const isOnline = onlineIds.includes(ag.id.toLowerCase());
      const runningTask = activeTasks.find((t) => t.agentId.toLowerCase() === ag.id.toLowerCase());
      return {
        agentId: ag.id,
        name: ag.name,
        description: ag.description || "未配置具体描述",
        isOnline,
        status: runningTask
          ? `忙碌中 (正在执行任务 ${runningTask.taskId}: ${runningTask.prompt.slice(0, 40)}... 进度 ${runningTask.progress || 10}%)`
          : isOnline
          ? "在线空闲 (可立即接单)"
          : "离线 (派发后将进入离线队列，待上线自动补发)",
      };
    });

    // 2. 获取当前会话最近历史记录以提供连贯上下文
    const recentMessages = await prisma.message.findMany({
      where: {
        conversationId,
        id: { not: geminiMessageId },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    const historyContext = recentMessages
      .reverse()
      .slice(0, -1) // 排除刚刚插入的最新一条 userPrompt 本身
      .map((m) => ({
        role: (m.senderType === "USER" ? "user" : "assistant") as "user" | "assistant",
        content: m.senderType === "USER" ? m.content : `[${m.senderName}]: ${m.content}`,
      }));

    // 3. 构造系统提示词
    const systemPrompt = `你是 Agent Hub 的总控调度大脑【Gemini 总控中枢 (@gemini)】。
你负责与用户直接对话，理解用户的意图，并根据当前集群中各个 Muse 智能体设备的职责描述（description）与状态，替用户规划、拆解并调用工具派发任务给对应的 Muse 设备。

### 当前可用的 Muse 智能体设备集群列表：
${
  clusterInfo.length > 0
    ? clusterInfo
        .map(
          (c) =>
            `- ID: "${c.agentId}" | 名称: "${c.name}" | 职责描述: "${c.description}" | 当前状态: ${c.status}`
        )
        .join("\n")
    : "（当前暂无注册的 Muse 设备）"
}

### 你的核心工作原则：
1. **何时派发任务**：
   - 当用户的请求需要某个或某几个 Muse 设备干活（例如写文案、做视频脚本、写代码、跑任务等），或者用户明确要求分配任务时，请立即调用 \`dispatch_task_to_muse\` 工具。
   - 你可以根据任务性质自动匹配最合适的 \`agentId\`（参考它们的职责描述），如果一个大任务涉及多个领域，你可以在一次工具调用中同时向多个不同的 Muse 设备派发各自的子任务！
   - 派发给 Muse 的 \`prompt\` 应当清晰、具体、完整，直接作为给该 Muse 执行的指令，不要包含多余的内部 ID 废话。
2. **何时直接回答**：
   - 如果用户只是向你日常提问、探讨方案、询问当前有哪些设备在线、或者不需要动用下属 Muse 设备即可解答，你可以直接回答或调用 \`get_muse_cluster_status\` 查看详情后回答。
3. **回复风格**：
   - 简洁、专业、条理清晰。如果调用了派发工具，请明确告诉用户你已经把什么任务指派给了哪台 Muse 设备（以及该设备是在线立即执行还是离线排队）。`;

    const tools = [
      {
        type: "function",
        function: {
          name: "dispatch_task_to_muse",
          description:
            "将一个或多个任务派发给指定的 Muse 智能体设备。支持同时给一台或多台不同的 Muse 下发任务。",
          parameters: {
            type: "object",
            properties: {
              dispatches: {
                type: "array",
                description: "要派发的任务列表",
                items: {
                  type: "object",
                  properties: {
                    agentId: {
                      type: "string",
                      description: "目标 Muse 设备的唯一 ID（如 muse-rednot, muse-video-bilibili, muse_one, muse-lucy 等）",
                    },
                    prompt: {
                      type: "string",
                      description: "下发给该 Muse 设备的完整、具体任务指令文本",
                    },
                    priority: {
                      type: "number",
                      description: "任务优先级：0 普通，1 高优，2 紧急（默认 0）",
                    },
                  },
                  required: ["agentId", "prompt"],
                },
              },
            },
            required: ["dispatches"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_muse_cluster_status",
          description: "查询当前所有 Muse 设备的在线状态、职责描述以及最近的任务执行情况",
          parameters: {
            type: "object",
            properties: {
              agentId: {
                type: "string",
                description: "可选，指定查询某一台 Muse 的 ID；不填则查询所有设备",
              },
            },
          },
        },
      },
    ];

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...historyContext,
      { role: "user", content: userPrompt },
    ];

    const dispatchedList: DispatchedSubTask[] = [];

    // 最多支持 3 轮 Tool Calling 循环
    for (let stepIdx = 0; stepIdx < 3; stepIdx++) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          tools,
          tool_choice: "auto",
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`模型接口响应异常 (${response.status}): ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const assistantMsg = data.choices?.[0]?.message;

      if (!assistantMsg) {
        throw new Error("模型未返回有效消息");
      }

      messages.push({
        role: "assistant",
        content: assistantMsg.content || null,
        tool_calls: assistantMsg.tool_calls,
      });

      // 如果没有触发工具调用，直接得出最终回复
      if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
        const finalContent = assistantMsg.content || "已完成处理。";
        await prisma.message.update({
          where: { id: geminiMessageId },
          data: {
            content: finalContent,
            status: "DONE",
            step: "COMPLETED",
            progress: 100,
          },
        });

        await cacheDel(CacheKeys.messages(conversationId), CacheKeys.conversations);

        gateway.broadcast({
          type: "TASK_COMPLETE",
          taskId: `gemini_${geminiMessageId}`,
          messageId: geminiMessageId,
          agentId: GEMINI_AGENT_ID,
          status: "COMPLETED",
          result: finalContent,
        });
        return;
      }

      // 处理工具调用
      await updateGeminiStatus("DISPATCHING_TOOLS", 65, "正在调用工具向 Muse 节点分发任务...");

      for (const toolCall of assistantMsg.tool_calls) {
        const fnName = toolCall.function?.name;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function?.arguments || "{}");
        } catch {
          args = {};
        }

        if (fnName === "dispatch_task_to_muse") {
          const rawDispatches = Array.isArray(args.dispatches)
            ? args.dispatches
            : args.agentId && args.prompt
            ? [{ agentId: args.agentId, prompt: args.prompt, priority: args.priority }]
            : [];

          const toolResults: Array<Record<string, unknown>> = [];

          for (const item of rawDispatches) {
            const targetId = String(item.agentId || "").trim().toLowerCase();
            const subPrompt = String(item.prompt || "").trim();
            const subPriority = typeof item.priority === "number" ? item.priority : defaultPriority;

            if (!targetId || !subPrompt) continue;

            const targetAgent = await prisma.agent.findUnique({
              where: { id: targetId },
            });

            if (!targetAgent) {
              toolResults.push({
                agentId: targetId,
                success: false,
                error: `找不到 ID 为 "${targetId}" 的 Muse 设备，请检查设备 ID 是否正确。`,
              });
              continue;
            }

            // 生成递增规范 taskId
            const now = new Date();
            const timeStr = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
            const taskId = `tsk_${timeStr}_${nanoid(6)}`;

            // 1. 创建 Task 入库
            await prisma.task.create({
              data: {
                taskId,
                agentId: targetId,
                conversationId,
                prompt: subPrompt,
                priority: subPriority,
                status: "PENDING",
              },
            });

            // 2. 在当前会话中创建该 Muse 的任务执行卡片消息
            const museMsg = await prisma.message.create({
              data: {
                conversationId,
                senderType: "AGENT",
                senderId: targetId,
                senderName: targetAgent.name || `${targetId} 助手`,
                content: `已接收由 @gemini 统筹指派的任务：${subPrompt}`,
                taskId,
                status: "PROCESSING",
                step: "QUEUED",
                progress: 5,
              },
            });

            // 3. 通过 WebSocket 网关真实下发给该 Muse
            const deliveredOnline = await gateway.dispatchTask(targetId, {
              taskId,
              prompt: subPrompt,
              priority: subPriority,
              payload: null,
            });

            // 4. 通知前端有新的子任务卡片产生
            gateway.broadcast({
              type: "NEW_MESSAGE",
              conversationId,
              message: museMsg,
            });

            dispatchedList.push({
              taskId,
              agentId: targetId,
              agentName: targetAgent.name,
              prompt: subPrompt,
              deliveredOnline,
              agentMessageId: museMsg.id,
            });

            toolResults.push({
              agentId: targetId,
              agentName: targetAgent.name,
              taskId,
              success: true,
              deliveryStatus: deliveredOnline
                ? "ONLINE_DISPATCHED (已通过 WebSocket 实时下发给在线设备)"
                : "QUEUED_OFFLINE (设备当前离线，已存入数据库队列，设备上线后自动补发)",
            });
          }

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: fnName,
            content: JSON.stringify({ results: toolResults }),
          });
        } else if (fnName === "get_muse_cluster_status") {
          const filterId = typeof args.agentId === "string" ? args.agentId.toLowerCase() : null;
          const recentTasks = await prisma.task.findMany({
            where: filterId ? { agentId: filterId } : {},
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              taskId: true,
              agentId: true,
              prompt: true,
              status: true,
              lastStep: true,
              progress: true,
              result: true,
              updatedAt: true,
            },
          });

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: fnName,
            content: JSON.stringify({
              clusterNodes: filterId ? clusterInfo.filter((c) => c.agentId === filterId) : clusterInfo,
              recentTasks,
            }),
          });
        } else {
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: fnName,
            content: JSON.stringify({ error: `Unknown tool: ${fnName}` }),
          });
        }
      }

      await updateGeminiStatus("SUMMARIZING", 85, "任务已下发，正在生成统筹汇报...");
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "调用 Gemini 总控模型异常";
    console.error("[GeminiOrchestrator Error]:", errMsg);

    await prisma.message.update({
      where: { id: geminiMessageId },
      data: {
        content: `[总控调用异常] ${errMsg}`,
        status: "FAILED",
        progress: 100,
      },
    });

    await cacheDel(CacheKeys.messages(conversationId));

    gateway.broadcast({
      type: "TASK_COMPLETE",
      taskId: `gemini_${geminiMessageId}`,
      messageId: geminiMessageId,
      agentId: GEMINI_AGENT_ID,
      status: "FAILED",
      result: `[总控调用异常] ${errMsg}`,
    });
  }
}
