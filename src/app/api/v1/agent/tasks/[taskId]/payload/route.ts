import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    let token = "";
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskId } = await params;
    const task = await prisma.task.findUnique({
      where: { taskId },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // 验证 Agent Token 归属
    const agent = await prisma.agent.findUnique({
      where: { id: task.agentId },
    });

    if (!agent || agent.token !== token) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      taskId: task.taskId,
      prompt: task.prompt,
      payload: task.payload,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "获取任务载荷失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
