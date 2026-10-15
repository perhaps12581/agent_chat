import { prisma } from "./db";

export async function seedAgents() {
  const token = process.env.AGENT_DEFAULT_TOKEN || "agtk_live_muse_secret_token_20261013";

  const defaultAgents = [
    { id: "muse", name: "Muse 主节点", avatar: "notion_muse_coder", token },
    { id: "muse1", name: "Muse 1号机", avatar: "notion_muse_architect", token },
    { id: "muse2", name: "Muse 2号机", avatar: "bottts_spark", token },
    { id: "muse3", name: "Muse 3号机", avatar: "notion_muse_researcher", token },
    { id: "muse4", name: "Muse 4号机", avatar: "bottts_quantum", token },
    { id: "dot", name: "Dot 助手", avatar: "shapes_prism", token },
  ];

  for (const ag of defaultAgents) {
    await prisma.agent.upsert({
      where: { id: ag.id },
      update: { token: ag.token },
      create: {
        id: ag.id,
        name: ag.name,
        avatar: ag.avatar,
        token: ag.token,
        status: "OFFLINE",
        capabilities: ["step_progress", "artifacts_meta"],
      },
    });
  }

  // 预置一个默认的群聊会话
  const existingConv = await prisma.conversation.findFirst({
    where: { title: "Agent 智能体协作群" },
  });

  if (!existingConv) {
    await prisma.conversation.create({
      data: {
        title: "Agent 智能体协作群",
        isGroup: true,
        targetAgentId: null,
        messages: {
          create: {
            senderType: "SYSTEM",
            senderId: "system",
            senderName: "系统提示",
            content: "欢迎来到智能体协作群！在群内输入 @muse 或点击智能体直接发起单聊。",
          },
        },
      },
    });
  }

  console.log("Database initialized: Agents and Default Conversation ready.");
}
