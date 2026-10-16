import { prisma } from "./db";
import { hashPassword } from "./auth";

export async function seedAgents() {
  // 1. 初始化默认管理员账号 (仅在数据库完全没有 admin 时初始化一次，不覆盖已有用户)
  const defaultPassword = process.env.ACCESS_PASSWORD;
  const existingAdmin = await prisma.user.findUnique({
    where: { username: "admin" },
  });

  if (!existingAdmin && defaultPassword) {
    const passwordHash = await hashPassword(defaultPassword);
    await prisma.user.create({
      data: {
        username: "admin",
        passwordHash,
        name: "管理员",
        role: "ADMIN",
        avatar: "notion_muse_coder",
      },
    });
    console.log("Admin user initialized (username: admin)");
  }

  // 2. 检查是否已有群聊，没有则建一个默认群聊大厅
  const existingConv = await prisma.conversation.findFirst({
    where: { isGroup: true },
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
            content: "欢迎来到智能体协作群！在群内输入 @ 即可派发任务。",
          },
        },
      },
    });
  }

  // 注意：不再自动注入任何假数据智能体（如 muse1/muse2/dot 等）！
  // 智能体完全由用户在界面上自主添加、维护，保持数据库纯净。
}
