import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AgentGateway } from "@/lib/agent-gateway";
import { nanoid } from "nanoid";

export async function GET() {
  try {
    const agents = await prisma.agent.findMany({
      orderBy: { createdAt: "asc" },
    });
    const onlineAgents = AgentGateway.getInstance().getOnlineAgents();

    // 查询当前正在处理中的任务（PENDING, ACCEPTED, RUNNING）
    const activeTasks = await prisma.task.findMany({
      where: {
        status: { in: ["PENDING", "ACCEPTED", "RUNNING"] },
      },
      orderBy: { updatedAt: "desc" },
    });

    // 建立 agentId -> activeTask 映射
    const activeTaskMap = new Map<string, (typeof activeTasks)[0]>();
    for (const t of activeTasks) {
      const k = t.agentId.toLowerCase();
      if (!activeTaskMap.has(k)) {
        activeTaskMap.set(k, t);
      }
    }

    const formatted = agents.map((agent) => {
      const isOnline = onlineAgents.includes(agent.id.toLowerCase());
      const currentTask = activeTaskMap.get(agent.id.toLowerCase()) || null;

      let statusSummary = "离线待连接";
      if (isOnline) {
        if (currentTask) {
          const stepStr = currentTask.lastStep ? ` [${currentTask.lastStep}]` : "";
          const progressStr = currentTask.progress ? ` (${currentTask.progress}%)` : "";
          statusSummary = `执行中: ${currentTask.prompt.slice(0, 36)}${stepStr}${progressStr}`;
        } else {
          statusSummary = "空闲就绪";
        }
      }

      return {
        ...agent,
        isOnline,
        isBusy: isOnline && !!currentTask,
        activeTask: currentTask
          ? {
              taskId: currentTask.taskId,
              prompt: currentTask.prompt,
              status: currentTask.status,
              step: currentTask.lastStep,
              progress: currentTask.progress,
              priority: currentTask.priority,
              updatedAt: currentTask.updatedAt,
            }
          : null,
        statusSummary,
      };
    });

    return NextResponse.json(formatted);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "获取 Agent 列表失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { capabilities, avatar, description } = body;
    let { id, name, token } = body;

    // 1. 验证 ID
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Agent ID 必填" }, { status: 400 });
    }

    id = id.trim().toLowerCase();

    if (!/^[a-zA-Z0-9_-]{2,32}$/.test(id)) {
      return NextResponse.json(
        { error: "Agent ID 格式无效，只支持 2-32 位的字母、数字、下划线及中划线" },
        { status: 400 }
      );
    }

    // 2. 验证 Name
    if (!name || typeof name !== "string") {
      name = `${id} 助手`;
    }
    name = name.trim().slice(0, 50);

    // 3. 检查 ID 是否已存在
    const existing = await prisma.agent.findUnique({
      where: { id },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Agent ID "${id}" 已经存在，不能重复注册` },
        { status: 409 }
      );
    }

    // 4. Token 生成或校验
    if (!token || typeof token !== "string" || !token.trim()) {
      token = `agtk_live_${nanoid(24)}`;
    } else {
      token = token.trim();
    }

    // 5. Capabilities 格式整理
    let parsedCapabilities = ["step_progress", "artifacts_meta"];
    if (Array.isArray(capabilities) && capabilities.length > 0) {
      parsedCapabilities = capabilities;
    }

    // 6. 入库创建
    const newAgent = await prisma.agent.create({
      data: {
        id,
        name,
        description: typeof description === "string" ? description.trim() : null,
        avatar: typeof avatar === "string" ? avatar.trim() : null,
        token,
        status: "OFFLINE",
        capabilities: parsedCapabilities,
      },
    });

    // 7. 广播全局状态更新
    AgentGateway.getInstance().broadcast({
      type: "AGENT_STATUS_CHANGE",
      agentId: id,
      action: "REGISTER",
    });

    return NextResponse.json(
      {
        ...newAgent,
        isOnline: false,
        message: "Agent 注册成功",
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "注册 Agent 失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, name, description, avatar, capabilities } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "缺少 agent id" }, { status: 400 });
    }

    const agentId = id.toLowerCase();
    const existing = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Agent 不存在" }, { status: 404 });
    }

    const updated = await prisma.agent.update({
      where: { id: agentId },
      data: {
        name: typeof name === "string" ? name.trim().slice(0, 50) : undefined,
        description: typeof description === "string" ? description.trim() : description === null ? null : undefined,
        avatar: typeof avatar === "string" ? avatar.trim() : avatar === null ? null : undefined,
        capabilities: Array.isArray(capabilities) ? capabilities : undefined,
      },
    });

    AgentGateway.getInstance().broadcast({
      type: "AGENT_STATUS_CHANGE",
      agentId,
      action: "UPDATE",
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "更新 Agent 失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "缺少 agent id 参数" }, { status: 400 });
    }

    const agentId = id.toLowerCase();

    // 1. 检查是否存在
    const existing = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!existing) {
      return NextResponse.json({ error: "该 Agent 不存在" }, { status: 404 });
    }

    // 2. 如果当前在线，断开其连接
    AgentGateway.getInstance().disconnectAgent(agentId, "Admin unregistered agent");

    // 3. 删除 agent
    await prisma.agent.delete({
      where: { id: agentId },
    });

    // 4. 广播状态变动
    AgentGateway.getInstance().broadcast({
      type: "AGENT_STATUS_CHANGE",
      agentId,
      action: "UNREGISTER",
    });

    return NextResponse.json({ success: true, message: `Agent ${agentId} 已注销` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "注销 Agent 失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
