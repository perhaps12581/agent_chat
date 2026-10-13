import { prisma } from "./db";

export async function seedAgents() {
  const token = process.env.AGENT_DEFAULT_TOKEN || "agtk_live_muse_secret_token_20261013";

  // 预置 muse
  await prisma.agent.upsert({
    where: { id: "muse" },
    update: { token },
    create: {
      id: "muse",
      name: "Muse 助手",
      token,
      status: "OFFLINE",
      capabilities: ["step_progress", "artifacts_meta"],
    },
  });

  // 预置 dot
  await prisma.agent.upsert({
    where: { id: "dot" },
    update: { token },
    create: {
      id: "dot",
      name: "Dot 助手",
      token,
      status: "OFFLINE",
      capabilities: ["step_progress"],
    },
  });

  // 预置一个默认的群聊会话
  const existingConv = await prisma.conversation.findFirst({
    where: { title: "Agent 智能体协作群" },
  });

  if (!existingConv) {
    await prisma.conversation.create({
      data: {
        title: "Agent 智能体协作群",
        isGroup: true,
        messages: {
          create: {
            senderType: "SYSTEM",
            senderId: "system",
            senderName: "系统提示",
            content: "欢迎来到智能体协作群！在群内输入 @muse 或 @dot 即可派发任务并实时追踪进度。",
          },
        },
      },
    });
  }

  console.log("Database initialized: Agents (muse, dot) and Default Conversation ready.");
}
