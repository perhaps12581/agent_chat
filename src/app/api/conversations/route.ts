import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const conversations = await prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });
    return NextResponse.json(conversations);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "获取会话失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, isGroup, targetAgentId } = body;

    // 如果是单聊且指定了 targetAgentId，若已有该 Agent 的单聊会话则直接返回复用
    if (isGroup === false && targetAgentId) {
      const existingDm = await prisma.conversation.findFirst({
        where: {
          isGroup: false,
          targetAgentId: targetAgentId.toLowerCase(),
        },
      });

      if (existingDm) {
        return NextResponse.json(existingDm);
      }
    }

    const conversation = await prisma.conversation.create({
      data: {
        title: title || (targetAgentId ? `@${targetAgentId} 单聊` : "新讨论组"),
        isGroup: isGroup ?? (targetAgentId ? false : true),
        targetAgentId: targetAgentId ? targetAgentId.toLowerCase() : null,
      },
    });
    return NextResponse.json(conversation);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "创建会话失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
