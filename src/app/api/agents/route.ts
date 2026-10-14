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

    const formatted = agents.map((agent) => ({
      ...agent,
      isOnline: onlineAgents.includes(agent.id.toLowerCase()),
    }));

    return NextResponse.json(formatted);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "获取 Agent 列表失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { capabilities } = body;
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

    // 3. 删除关联任务与消息中不需要级联阻断的地方，删除 agent
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
