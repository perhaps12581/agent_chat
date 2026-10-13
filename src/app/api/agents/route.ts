import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AgentGateway } from "@/lib/agent-gateway";

export async function GET() {
  try {
    const agents = await prisma.agent.findMany();
    const onlineAgents = AgentGateway.getInstance().getOnlineAgents();

    const formatted = agents.map((agent) => ({
      ...agent,
      isOnline: onlineAgents.includes(agent.id.toLowerCase()),
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
