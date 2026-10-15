// 精美 Google Material / Notion / Bottts 风格头像库定义
export interface AvatarOption {
  id: string;
  category: "bottts" | "notion" | "shapes" | "adventurer";
  label: string;
  url: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  // 1. Google/Notion 拟物精美极客风 (Notionists 系列)
  {
    id: "notion_muse_coder",
    category: "notion",
    label: "极客程序员",
    url: "https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=b6e3f4,c0aede,d1d4f9",
  },
  {
    id: "notion_muse_architect",
    category: "notion",
    label: "系统架构师",
    url: "https://api.dicebear.com/7.x/notionists/svg?seed=Oliver&backgroundColor=ffd5dc,ffdfbf,ffd5dc",
  },
  {
    id: "notion_muse_designer",
    category: "notion",
    label: "UI设计师",
    url: "https://api.dicebear.com/7.x/notionists/svg?seed=Milo&backgroundColor=c0aede,d1d4f9",
  },
  {
    id: "notion_muse_researcher",
    category: "notion",
    label: "算法研究员",
    url: "https://api.dicebear.com/7.x/notionists/svg?seed=Sophia&backgroundColor=b6e3f4,ffd5dc",
  },
  {
    id: "notion_muse_ops",
    category: "notion",
    label: "运维专家",
    url: "https://api.dicebear.com/7.x/notionists/svg?seed=Leo&backgroundColor=ffdfbf,d1d4f9",
  },

  // 2. 经典高质感精致机器人 (Bottts 系列)
  {
    id: "bottts_alpha",
    category: "bottts",
    label: "智能核心 Alpha",
    url: "https://api.dicebear.com/7.x/bottts/svg?seed=MusePrime&backgroundColor=6366f1",
  },
  {
    id: "bottts_spark",
    category: "bottts",
    label: "敏捷机 Spark",
    url: "https://api.dicebear.com/7.x/bottts/svg?seed=Sparky&backgroundColor=10b981",
  },
  {
    id: "bottts_cyber",
    category: "bottts",
    label: "数智机 Cyber",
    url: "https://api.dicebear.com/7.x/bottts/svg?seed=CyberCore&backgroundColor=f59e0b",
  },
  {
    id: "bottts_quantum",
    category: "bottts",
    label: "量子核心 Q",
    url: "https://api.dicebear.com/7.x/bottts/svg?seed=Quantum&backgroundColor=8b5cf6",
  },
  {
    id: "bottts_sentinel",
    category: "bottts",
    label: "守卫机 Sentinel",
    url: "https://api.dicebear.com/7.x/bottts/svg?seed=Sentinel&backgroundColor=06b6d4",
  },

  // 3. Google Material 几何现代风 (Shapes 系列)
  {
    id: "shapes_prism",
    category: "shapes",
    label: "棱镜 Prism",
    url: "https://api.dicebear.com/7.x/shapes/svg?seed=Prism&backgroundColor=3b82f6",
  },
  {
    id: "shapes_aurora",
    category: "shapes",
    label: "极光 Aurora",
    url: "https://api.dicebear.com/7.x/shapes/svg?seed=Aurora&backgroundColor=ec4899",
  },
  {
    id: "shapes_matrix",
    category: "shapes",
    label: "矩阵 Matrix",
    url: "https://api.dicebear.com/7.x/shapes/svg?seed=Matrix&backgroundColor=14b8a6",
  },
  {
    id: "shapes_nexus",
    category: "shapes",
    label: "枢纽 Nexus",
    url: "https://api.dicebear.com/7.x/shapes/svg?seed=Nexus&backgroundColor=f97316",
  },
];

// 根据 agentId 或 avatar 字段获取对应头像地址
export function getAgentAvatarUrl(avatarIdOrUrl?: string | null, agentId = ""): string {
  if (!avatarIdOrUrl) {
    // 默认根据 agentId 确定性生成一个高品质 Google/Notion 风格头像
    const defaultSeed = agentId || "muse";
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(defaultSeed)}&backgroundColor=252a34`;
  }

  // 如果存的是完整图片 url
  if (avatarIdOrUrl.startsWith("http://") || avatarIdOrUrl.startsWith("https://")) {
    return avatarIdOrUrl;
  }

  // 从预置库中找
  const matched = AVATAR_OPTIONS.find((a) => a.id === avatarIdOrUrl);
  if (matched) {
    return matched.url;
  }

  return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(avatarIdOrUrl)}&backgroundColor=252a34`;
}
