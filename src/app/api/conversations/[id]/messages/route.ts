import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AgentGateway } from "@/lib/agent-gateway";
import { nanoid } from "nanoid";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(messages);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const content = (body.content || "").trim();

    if (!content) {
      return NextResponse.json({ error: "消息内容不能为空" }, { status: 400 });
    }

    // 1. 保存用户的消息
    const userMessage = await prisma.message.create({
      data: {
        conversationId: id,
        senderType: "USER",
        senderId: "user_me",
        senderName: "我",
        content,
        status: "SENT",
      },
    });

    // 2. 检测是否提及了任何 Agent (例如 @muse, @muse1, @muse2, @dot 等)
    const match = content.match(/@([a-zA-Z0-9_-]+)\s*([\s\S]*)/i);
    if (match) {
      const targetAgentId = match[1].toLowerCase();
      const taskPrompt = match[2]?.trim() || content;

      // 验证是否是已知存在的 Agent
      const targetAgent = await prisma.agent.findUnique({
        where: { id: targetAgentId },
      });

      if (targetAgent) {
        // 生成满足单调递增规范的 taskId: tsk_YYYYMMDDHHmmss_rand
        const now = new Date();
        const timeStr = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
        const taskId = `tsk_${timeStr}_${nanoid(6)}`;

        // 3. 创建 Task 记录
        await prisma.task.create({
          data: {
            taskId,
            agentId: targetAgentId,
            conversationId: id,
            prompt: taskPrompt,
            priority: body.priority || 0,
            status: "PENDING",
          },
        });

        // 4. 在群聊中插入 Agent 正在处理的占位卡片消息
        const agentMessage = await prisma.message.create({
          data: {
            conversationId: id,
            senderType: "AGENT",
            senderId: targetAgentId,
            senderName: targetAgent.name || `${targetAgentId} 助手`,
            content: "任务已接收，正在排队处理...",
            taskId,
            status: "PROCESSING",
            step: "QUEUED",
            progress: 5,
          },
        });

        // 5. 调用网关下发任务
        const gateway = AgentGateway.getInstance();
        await gateway.dispatchTask(targetAgentId, {
          taskId,
          prompt: taskPrompt,
          priority: body.priority || 0,
          payload: {
            conversationId: id,
            userMessageId: userMessage.id,
          },
        });

        return NextResponse.json({
          userMessage,
          agentMessage,
        });
      }
    }

    return NextResponse.json({ userMessage });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
