import { prisma } from "./db";
import { hashPassword } from "./auth";

export async function seedAgents() {
  const token = process.env.AGENT_DEFAULT_TOKEN || "agtk_live_muse_secret_token_20261013";

  // 1. 初始化默认管理员账号 (admin)
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

  // 2. 初始化智能体节点
  const defaultAgents = [
    { id: "muse", name: "Muse 主节点", description: "全能架构与复杂任务总控，统筹处理综合性需求", avatar: "notion_muse_coder", token },
    { id: "muse1", name: "Muse 1号机", description: "后端服务构建、数据库设计与 API 接口重构专家", avatar: "notion_muse_architect", token },
    { id: "muse2", name: "Muse 2号机", description: "Web 前端界面、交互体验与高颜值样式调优助手", avatar: "bottts_spark", token },
    { id: "muse3", name: "Muse 3号机", description: "算法分析、数据处理与知识检索计算节点", avatar: "notion_muse_researcher", token },
    { id: "muse4", name: "Muse 4号机", description: "自动化测试、代码审计与系统巡检守护节点", avatar: "bottts_quantum", token },
    { id: "dot", name: "Dot 助手", description: "轻量即时应答与通用信息助理", avatar: "shapes_prism", token },
  ];

  for (const ag of defaultAgents) {
    await prisma.agent.upsert({
      where: { id: ag.id },
      update: { token: ag.token, description: ag.description },
      create: {
        id: ag.id,
        name: ag.name,
        description: ag.description,
        avatar: ag.avatar,
        token: ag.token,
        status: "OFFLINE",
        capabilities: ["step_progress", "artifacts_meta"],
      },
    });
  }

  // 3. 预置一个默认的群聊会话
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

  console.log("Database initialized: Users, Agents and Default Conversation ready.");
}
