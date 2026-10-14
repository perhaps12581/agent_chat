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
    const conversation = await prisma.conversation.create({
      data: {
        title: body.title || "新任务讨论群",
        isGroup: body.isGroup ?? true,
      },
    });
    return NextResponse.json(conversation);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "创建会话失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
