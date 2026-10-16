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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "获取消息失败";
    return NextResponse.json({ error: message }, { status: 500 });
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

    // 查询当前会话是否为绑定单个 Agent 的单聊
    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
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

    // 2. 判断任务分发目标：
    // A. 如果是单聊（targetAgentId 存在），直接派发给该 Agent，无需 @！
    // B. 如果是群聊，检测消息中是否包含 @AgentId
    let targetAgentId: string | null = null;
    let taskPrompt = content;

    if (!conversation.isGroup && conversation.targetAgentId) {
      targetAgentId = conversation.targetAgentId.toLowerCase();
      // 如果单聊里也顺手打了 @muse，清理掉前缀
      const match = content.match(/@([a-zA-Z0-9_-]+)\s*([\s\S]*)/i);
      if (match && match[1].toLowerCase() === targetAgentId) {
        taskPrompt = match[2]?.trim() || content;
      }
    } else {
      const match = content.match(/@([a-zA-Z0-9_-]+)\s*([\s\S]*)/i);
      if (match) {
        targetAgentId = match[1].toLowerCase();
        taskPrompt = match[2]?.trim() || content;
      }
    }

    if (targetAgentId) {
      // 验证是否是已知存在的 Agent
      const targetAgent = await prisma.agent.findUnique({
        where: { id: targetAgentId },
      });

      if (targetAgent) {
        // 生成满足单调递增规范的 taskId: tsk_YYYYMMDDHHmmss_rand
        const now = new Date();
        const timeStr = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
        const taskId = `tsk_${timeStr}_${nanoid(6)}`;

        // 仅在前端显式传递业务参数时才保留 payload，严禁注入内部 conversationId / userMessageId
        const cleanPayload =
          body.payload && typeof body.payload === "object" && Object.keys(body.payload).length > 0
            ? body.payload
            : null;

        // 3. 创建 Task 记录
        await prisma.task.create({
          data: {
            taskId,
            agentId: targetAgentId,
            conversationId: id,
            prompt: taskPrompt,
            priority: body.priority || 0,
            payload: cleanPayload,
            status: "PENDING",
          },
        });

        // 4. 在会话中插入 Agent 正在处理的轻量占位消息
        const agentMessage = await prisma.message.create({
          data: {
            conversationId: id,
            senderType: "AGENT",
            senderId: targetAgentId,
            senderName: targetAgent.name || `${targetAgentId} 助手`,
            content: "思考中...",
            taskId,
            status: "PROCESSING",
            step: "QUEUED",
            progress: 5,
          },
        });

        // 5. 调用网关下发纯净任务内容
        const gateway = AgentGateway.getInstance();
        await gateway.dispatchTask(targetAgentId, {
          taskId,
          prompt: taskPrompt,
          priority: body.priority || 0,
          payload: cleanPayload,
        });

        return NextResponse.json({
          userMessage,
          agentMessage,
        });
      }
    }

    return NextResponse.json({ userMessage });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "发送消息失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
