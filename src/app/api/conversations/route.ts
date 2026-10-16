import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cacheGet, cacheSet, cacheDel, CacheKeys } from "@/lib/redis";

export async function GET() {
  try {
    // 1. 尝试从 Redis 缓存获取会话列表 (加速页面初次加载与刷新)
    const cached = await cacheGet<unknown[]>(CacheKeys.conversations);
    if (cached) {
      return NextResponse.json(cached);
    }

    // 2. 缓存未命中时查库
    const conversations = await prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // 3. 回写 Redis 缓存 60 秒
    await cacheSet(CacheKeys.conversations, conversations, 60);

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

    // 清除会话列表缓存
    await cacheDel(CacheKeys.conversations);

    return NextResponse.json(conversation);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "创建会话失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
