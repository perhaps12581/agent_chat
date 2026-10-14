import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AgentGateway } from "@/lib/agent-gateway";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agentId = id.toLowerCase();

    const existing = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!existing) {
      return NextResponse.json({ error: "该 Agent 不存在" }, { status: 404 });
    }

    AgentGateway.getInstance().disconnectAgent(agentId, "Admin unregistered agent");

    await prisma.agent.delete({
      where: { id: agentId },
    });

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agentId = id.toLowerCase();
    const body = await req.json();
    const { name, token, capabilities } = body;

    const data: { name?: string; token?: string; capabilities?: string[] } = {};
    if (typeof name === "string" && name.trim()) data.name = name.trim();
    if (typeof token === "string" && token.trim()) data.token = token.trim();
    if (Array.isArray(capabilities)) data.capabilities = capabilities;

    const updated = await prisma.agent.update({
      where: { id: agentId },
      data,
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
