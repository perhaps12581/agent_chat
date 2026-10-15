"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Send,
  User,
  CheckCircle2,
  Clock,
  AlertCircle,
  Layers,
  Sparkles,
  LogOut,
  Plus,
  Settings,
  Trash2,
  AtSign,
  Copy,
  Check,
  FileText,
  MessageSquare,
  Users,
  ImageIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { appConfig, apiFetch } from "@/lib/config";
import AgentRegisterModal from "@/components/AgentRegisterModal";
import AgentConfigModal from "@/components/AgentConfigModal";
import MentionDropdown, { AgentItem } from "@/components/MentionDropdown";
import AgentStatusPopover from "@/components/AgentStatusPopover";
import AvatarPickerModal from "@/components/AvatarPickerModal";
import { getAgentAvatarUrl } from "@/lib/avatars";

interface Message {
  id: string;
  senderType: "USER" | "AGENT" | "SYSTEM";
  senderId: string;
  senderName: string;
  content: string;
  taskId?: string;
  status?: string;
  step?: string;
  progress?: number;
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string;
  isGroup: boolean;
  targetAgentId?: string | null;
}

interface UserInfo {
  id: string;
  username: string;
  name: string;
  role: string;
  avatar?: string | null;
}

export default function ChatHubPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [priority, setPriority] = useState<number>(0);

  // 弹窗状态
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  // 头像选择弹窗
  const [avatarModalTarget, setAvatarModalTarget] = useState<AgentItem | null>(null);

  // @ 下拉状态
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. 初始化会话与 Agent 列表与当前用户
  useEffect(() => {
    fetchCurrentUser();
    fetchConversations();
    fetchAgents();
    const interval = setInterval(fetchAgents, 6000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. 监听全局 SSE 事件 (实时同步 Agent 状态与任务推进)
  useEffect(() => {
    const sseUrl = appConfig.apiUrl("/api/events");
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "TASK_PROGRESS") {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.taskId === data.taskId
                ? {
                    ...msg,
                    step: data.step,
                    progress: data.progress ?? msg.progress,
                    content: data.message || msg.content,
                    status: "PROCESSING",
                  }
                : msg
            )
          );
          fetchAgents();
        } else if (data.type === "TASK_COMPLETE") {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.taskId === data.taskId
                ? {
                    ...msg,
                    status: "DONE",
                    progress: 100,
                    content: data.result || msg.content,
                  }
                : msg
            )
          );
          fetchAgents();
        } else if (data.type === "TASK_DISPATCH" || data.type === "AGENT_STATUS_CHANGE") {
          fetchAgents();
        }
      } catch {
        // 忽略 SSE 异常
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // 3. 选中会话改变时加载历史消息
  useEffect(() => {
    if (activeConvId) {
      fetchMessages(activeConvId);
    }
  }, [activeConvId]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchCurrentUser() {
    const res = await apiFetch<UserInfo>("/api/auth/me");
    if (res.data) {
      setCurrentUser(res.data);
    }
  }

  async function fetchConversations() {
    const res = await apiFetch<Conversation[]>("/api/conversations");
    if (Array.isArray(res.data) && res.data.length > 0) {
      setConversations(res.data);
      if (!activeConvId) {
        setActiveConvId(res.data[0].id);
      }
    }
  }

  async function fetchAgents() {
    const res = await apiFetch<AgentItem[]>("/api/agents");
    if (Array.isArray(res.data)) {
      setAgents(res.data);
    }
  }

  async function fetchMessages(convId: string) {
    const res = await apiFetch<Message[]>(`/api/conversations/${convId}/messages`);
    if (Array.isArray(res.data)) {
      setMessages(res.data);
    }
  }

  // 切换或开启单聊
  async function handleOpenDirectChat(agent: AgentItem) {
    // 检查是否已有该 Agent 的单聊
    const existing = conversations.find(
      (c) => !c.isGroup && c.targetAgentId?.toLowerCase() === agent.id.toLowerCase()
    );

    if (existing) {
      setActiveConvId(existing.id);
      setTimeout(() => textareaRef.current?.focus(), 50);
      return;
    }

    // 创建新的单聊
    const res = await apiFetch<Conversation>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        title: `${agent.name} (单聊)`,
        isGroup: false,
        targetAgentId: agent.id,
      }),
    });

    if (res.data) {
      setConversations((prev) => [res.data!, ...prev]);
      setActiveConvId(res.data.id);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }

  // 创建新群聊
  async function handleCreateGroup() {
    const title = window.prompt("请输入新群聊名称:", `智能体讨论组 ${conversations.length + 1}`);
    if (!title || !title.trim()) return;

    const res = await apiFetch<Conversation>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ title: title.trim(), isGroup: true }),
    });

    if (res.data) {
      setConversations((prev) => [res.data!, ...prev]);
      setActiveConvId(res.data.id);
    }
  }

  // 保存头像
  async function handleSaveAvatar(agentId: string, avatarUrlOrId: string) {
    await apiFetch("/api/agents", {
      method: "PATCH",
      body: JSON.stringify({ id: agentId, avatar: avatarUrlOrId }),
    });
    fetchAgents();
  }

  // 删除 Agent
  async function handleDeleteAgent(agentId: string, agentName: string) {
    if (!window.confirm(`确定要注销智能体【${agentName} (@${agentId})】吗？`)) {
      return;
    }
    const res = await apiFetch(`/api/agents?id=${agentId}`, { method: "DELETE" });
    if (!res.error) {
      fetchAgents();
    }
  }

  // 复制 Agent Token
  function handleCopyToken(token: string, agentId: string) {
    navigator.clipboard.writeText(token);
    setCopiedTokenId(agentId);
    setTimeout(() => setCopiedTokenId(null), 2000);
  }

  // 输入框文本变化与 @ 检测
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    const cursor = e.target.selectionStart || 0;
    setInputValue(val);

    const textBeforeCursor = val.slice(0, cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : " ";
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);

      if ((/\s/.test(charBeforeAt) || lastAtIndex === 0) && !/\s/.test(textAfterAt)) {
        setMentionFilter(textAfterAt);
        setIsMentionOpen(true);
        setMentionIndex(0);
        return;
      }
    }

    setIsMentionOpen(false);
  }

  function handleTriggerMention() {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursor = textarea.selectionStart || inputValue.length;
    const prefix = inputValue.slice(0, cursor);
    const suffix = inputValue.slice(cursor);

    const needsSpace = prefix.length > 0 && !/\s$/.test(prefix);
    const newText = `${prefix}${needsSpace ? " " : ""}@${suffix}`;
    const newCursor = cursor + (needsSpace ? 2 : 1);

    setInputValue(newText);
    setIsMentionOpen(true);
    setMentionFilter("");
    setMentionIndex(0);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursor, newCursor);
    }, 10);
  }

  function handleSelectAgent(agent: AgentItem) {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart || inputValue.length;
    const textBeforeCursor = inputValue.slice(0, cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    let newText = "";
    let newCursor = 0;

    if (lastAtIndex !== -1) {
      const prefix = inputValue.slice(0, lastAtIndex);
      const suffix = inputValue.slice(cursor);
      newText = `${prefix}@${agent.id} ${suffix}`;
      newCursor = (prefix + `@${agent.id} `).length;
    } else {
      newText = `@${agent.id} ${inputValue}`;
      newCursor = `@${agent.id} `.length;
    }

    setInputValue(newText);
    setIsMentionOpen(false);

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(newCursor, newCursor);
      }
    }, 10);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (isMentionOpen) {
      const filtered = agents
        .filter((ag) => {
          const q = mentionFilter.toLowerCase().trim();
          if (!q) return true;
          return ag.id.toLowerCase().includes(q) || (ag.name && ag.name.toLowerCase().includes(q));
        })
        .sort((a, b) => (a.isOnline === b.isOnline ? 0 : a.isOnline ? -1 : 1));

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % (filtered.length || 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filtered[mentionIndex]) {
          handleSelectAgent(filtered[mentionIndex]);
        } else {
          setIsMentionOpen(false);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsMentionOpen(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!inputValue.trim() || !activeConvId || isSending) return;

    const text = inputValue.trim();
    setInputValue("");
    setIsSending(false);
    setIsMentionOpen(false);

    try {
      setIsSending(true);
      const res = await apiFetch<{ userMessage?: Message; agentMessage?: Message }>(
        `/api/conversations/${activeConvId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ content: text, priority }),
        }
      );

      if (res.data) {
        const { userMessage, agentMessage } = res.data;
        if (userMessage) setMessages((prev) => [...prev, userMessage]);
        if (agentMessage) setMessages((prev) => [...prev, agentMessage]);
      }
      fetchAgents();
    } catch (err) {
      console.error("发送异常:", err);
    } finally {
      setIsSending(false);
      setTimeout(() => textareaRef.current?.focus(), 10);
    }
  }

  const currentConv = conversations.find((c) => c.id === activeConvId);
  const isDirectChat = currentConv ? !currentConv.isGroup && !!currentConv.targetAgentId : false;
  const directTargetAgent = isDirectChat
    ? agents.find((a) => a.id.toLowerCase() === currentConv?.targetAgentId?.toLowerCase())
    : null;

  const onlineCount = agents.filter((a) => a.isOnline).length;
  const targetAgentMatch = inputValue.match(/@([a-zA-Z0-9_-]+)/);
  const detectedTargetAgent = targetAgentMatch
    ? agents.find((a) => a.id.toLowerCase() === targetAgentMatch[1].toLowerCase())
    : null;

  return (
    <div className="flex h-screen bg-[#14161a] text-[#e3e7ee] font-sans antialiased overflow-hidden selection:bg-indigo-500/30 selection:text-white">
      {/* 弹窗：注册 Agent */}
      <AgentRegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={() => fetchAgents()}
      />

      {/* 弹窗：部署配置 */}
      <AgentConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />

      {/* 弹窗：设置头像形象 */}
      {avatarModalTarget && (
        <AvatarPickerModal
          isOpen={true}
          agentId={avatarModalTarget.id}
          agentName={avatarModalTarget.name}
          currentAvatar={avatarModalTarget.avatar}
          onClose={() => setAvatarModalTarget(null)}
          onSave={async (avatar) => {
            await handleSaveAvatar(avatarModalTarget.id, avatar);
          }}
        />
      )}

      {/* ================= 左侧侧边栏 (默认展示智能体集群与单聊入口) ================= */}
      <aside className="w-80 border-r border-[#22262f] flex flex-col bg-[#101215] select-none flex-shrink-0">
        {/* 顶部标题栏 */}
        <div className="h-14 px-4 border-b border-[#22262f] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-semibold text-sm tracking-tight text-[#e2e6eb]">
                Agent Hub
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsConfigOpen(true)}
              className="p-1.5 rounded-lg text-[#848e9f] hover:text-[#d0d6e2] hover:bg-[#1a1d23] transition-colors"
              title="部署与连接配置"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsRegisterOpen(true)}
              className="p-1.5 rounded-lg text-[#848e9f] hover:text-[#d0d6e2] hover:bg-[#1a1d23] transition-colors"
              title="添加新智能体"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 会话频道切换：单聊与群聊 */}
        <div className="px-3 py-2.5 border-b border-[#20242c] bg-[#121418]">
          <div className="flex items-center justify-between mb-1.5 text-[11px] text-[#6d7685]">
            <span className="font-medium uppercase tracking-wider text-[10px]">会话列表</span>
            <button
              onClick={handleCreateGroup}
              className="hover:text-indigo-400 flex items-center gap-0.5 transition-colors text-[11px]"
              title="新建群聊频道"
            >
              <Plus className="w-3 h-3" />
              <span>新建群聊</span>
            </button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {conversations.map((conv) => {
              const isDirect = !conv.isGroup && !!conv.targetAgentId;
              const directAgent = isDirect
                ? agents.find((a) => a.id.toLowerCase() === conv.targetAgentId?.toLowerCase())
                : null;
              const avatar = directAgent ? getAgentAvatarUrl(directAgent.avatar, directAgent.id) : null;

              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-all ${
                    activeConvId === conv.id
                      ? "bg-[#222731] text-[#e0e5ed] border border-[#333a49] shadow-sm"
                      : "text-[#858f9f] hover:bg-[#171a20] hover:text-[#c4cbd5]"
                  }`}
                >
                  {isDirect && avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar} alt="" className="w-3.5 h-3.5 rounded object-cover" />
                  ) : conv.isGroup ? (
                    <Users className="w-3 h-3 text-indigo-400" />
                  ) : (
                    <MessageSquare className="w-3 h-3 text-emerald-400" />
                  )}
                  <span className="truncate max-w-[120px]">{conv.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 主体区域：智能体节点列表 (点击直接进入单聊，带头像与悬停状态) */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="px-3.5 py-2.5 flex items-center justify-between text-xs text-[#7f8897] border-b border-[#1c2027]">
            <span className="font-medium text-[11px] uppercase tracking-wider">
              智能体列表 ({onlineCount}/{agents.length} 在线)
            </span>
            <span className="text-[10px] text-[#646d7c]">点条目直接单聊</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {agents.length === 0 ? (
              <div className="text-center py-10 text-xs text-[#636c7b]">
                暂无节点，点击右上角 “+” 添加
              </div>
            ) : (
              agents.map((agent: AgentItem) => {
                const isBusy = agent.isOnline && !!agent.activeTask;
                const avatarUrl = getAgentAvatarUrl(agent.avatar, agent.id);
                const isCurrentDm =
                  isDirectChat && directTargetAgent?.id.toLowerCase() === agent.id.toLowerCase();

                return (
                  <div
                    key={agent.id}
                    onClick={() => handleOpenDirectChat(agent)}
                    className={`p-2.5 rounded-xl border transition-all group relative cursor-pointer ${
                      isCurrentDm
                        ? "bg-[#1c2029] border-indigo-500/40 shadow-sm"
                        : "bg-[#16181e] border-[#232731] hover:border-[#313745] hover:bg-[#1a1d24]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {/* 左侧：精美形象头像与状态指示 */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="relative flex-shrink-0">
                          <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#20252e] border border-[#2b303a] flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={avatarUrl}
                              alt={agent.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#16181e] ${
                              isBusy
                                ? "bg-amber-400 shadow-sm shadow-amber-400/50"
                                : agent.isOnline
                                ? "bg-emerald-400 shadow-sm shadow-emerald-400/50"
                                : "bg-neutral-600"
                            }`}
                          />
                        </div>

                        {/* 中间信息：名称 + ID + 悬浮工作内容 icon */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-[#dce1ea] truncate max-w-[105px]">
                              {agent.name}
                            </span>

                            {/* 工作内容悬浮图标！ */}
                            <AgentStatusPopover agent={agent} side="right" />

                            <span className="text-[11px] font-mono text-[#6d7686] truncate">
                              @{agent.id}
                            </span>
                          </div>

                          {/* 简短状态行 */}
                          <div className="text-[11px] text-[#717b8b] truncate mt-0.5">
                            {isBusy && agent.activeTask ? (
                              <span className="text-amber-400/90 truncate flex items-center gap-1 text-[10px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                正在执行: {agent.activeTask.prompt}
                              </span>
                            ) : agent.isOnline ? (
                              <span className="text-emerald-400/80 text-[10px]">
                                空闲待命 · 点击单聊
                              </span>
                            ) : (
                              <span className="text-[#596270] text-[10px]">离线</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 右侧快捷操作按钮 */}
                      <div
                        className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* 换头像 */}
                        <button
                          onClick={() => setAvatarModalTarget(agent)}
                          className="p-1 rounded-md hover:bg-[#20252e] text-[#6b7585] hover:text-indigo-300 transition-colors"
                          title="修改形象头像"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                        </button>

                        {/* 复制 Token */}
                        {agent.token && (
                          <button
                            onClick={() => agent.token && handleCopyToken(agent.token, agent.id)}
                            className="p-1 rounded-md hover:bg-[#20252e] text-[#6b7585] hover:text-amber-300 transition-colors"
                            title="复制接入 Token"
                          >
                            {copiedTokenId === agent.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}

                        {/* 注销 */}
                        <button
                          onClick={() => handleDeleteAgent(agent.id, agent.name)}
                          className="p-1 rounded-md hover:bg-rose-950/40 text-[#606979] hover:text-rose-400 transition-colors"
                          title="注销"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </aside>

      {/* ================= 右侧主对话与执行流 ================= */}
      <main className="flex-1 flex flex-col bg-[#15171c] min-w-0">
        {/* 顶部极简信息栏 */}
        <header className="h-14 border-b border-[#22262f] px-5 flex items-center justify-between bg-[#15171c]/90 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            {isDirectChat && directTargetAgent ? (
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="w-7 h-7 rounded-lg overflow-hidden bg-[#20252e] border border-[#2d3340]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getAgentAvatarUrl(directTargetAgent.avatar, directTargetAgent.id)}
                      alt={directTargetAgent.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-[#15171c] ${
                      directTargetAgent.isOnline ? "bg-emerald-400" : "bg-neutral-500"
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-semibold text-sm text-[#e0e4ec]">
                      {directTargetAgent.name}
                    </h2>
                    <span className="text-[11px] font-mono text-[#747e8e]">
                      @{directTargetAgent.id}
                    </span>
                  </div>
                  <span className="text-[10px] text-indigo-400 font-medium">
                    1对1 单聊模式 (直接发送无需 @)
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <h2 className="font-medium text-sm text-[#e0e4ec]">
                  {currentConv?.title || "协作群聊"}
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded bg-[#1e222b] text-[#8690a0] border border-[#2b303c]">
                  群聊模式
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {currentUser && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a1d24] border border-[#262c36] text-xs">
                <div className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-[10px] font-semibold">
                  {currentUser.username.slice(0, 1).toUpperCase()}
                </div>
                <span className="text-[#c8d1de] font-medium text-[11px]">{currentUser.name || currentUser.username}</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 font-mono">
                  {currentUser.role}
                </span>
              </div>
            )}

            <button
              onClick={async () => {
                await apiFetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-[#272b35] hover:bg-[#1f232b] text-[#8690a0] hover:text-[#d3d9e4] flex items-center gap-1.5 transition-colors cursor-pointer"
              title="退出登录"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>退出</span>
            </button>
          </div>
        </header>

        {/* 消息历史滚动列表 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg) => {
            const isMe = msg.senderType === "USER";
            const isAgent = msg.senderType === "AGENT";
            const isSystem = msg.senderType === "SYSTEM";

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-3">
                  <div className="text-xs text-[#6e7787] bg-[#1a1d23] px-3 py-1 rounded-full border border-[#252a34]">
                    {msg.content}
                  </div>
                </div>
              );
            }

            const senderAgent = isAgent ? agents.find((a) => a.id.toLowerCase() === msg.senderId.toLowerCase()) : null;
            const senderAvatar = isAgent && senderAgent ? getAgentAvatarUrl(senderAgent.avatar, senderAgent.id) : null;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${isMe ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                {/* 头像 */}
                <div
                  className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden ${
                    isMe
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-[#1f242c] border border-[#2a313d]"
                  }`}
                >
                  {isMe ? (
                    <User className="w-4 h-4" />
                  ) : senderAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={senderAvatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-emerald-400">
                      {msg.senderId.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* 消息正文区 */}
                <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <div className="text-xs text-[#717b8b] mb-1 flex items-center gap-2">
                    <span className="font-medium text-[#c0c8d4]">{msg.senderName}</span>
                    <span className="text-[10px] text-[#596270]">
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* 智能体任务处理卡片 */}
                  {isAgent && msg.taskId ? (
                    <div className="w-full min-w-[320px] sm:min-w-[440px] rounded-2xl border border-[#292e39] bg-[#1a1d24]/90 p-4 space-y-3 shadow-lg">
                      {/* 卡片头部 */}
                      <div className="flex items-center justify-between text-xs pb-2 border-b border-[#242933]">
                        <div className="flex items-center gap-1.5 font-mono text-[#7b8595]">
                          <FileText className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{msg.taskId}</span>
                        </div>
                        <div>
                          {msg.status === "DONE" ? (
                            <span className="text-emerald-400 flex items-center gap-1 text-[11px] font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> 已完成
                            </span>
                          ) : msg.status === "FAILED" ? (
                            <span className="text-rose-400 flex items-center gap-1 text-[11px] font-medium">
                              <AlertCircle className="w-3.5 h-3.5" /> 执行失败
                            </span>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-1.5 text-[11px] font-medium">
                              <Clock className="w-3.5 h-3.5 animate-spin" /> 执行中...
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 步骤与进度 */}
                      {msg.status !== "DONE" && (
                        <div className="space-y-1.5 bg-[#13151a] p-2.5 rounded-xl border border-[#232731]">
                          <div className="flex justify-between text-[11px] text-[#8690a0]">
                            <span className="flex items-center gap-1">
                              <span>当前阶段:</span>
                              <strong className="text-indigo-300 font-mono">
                                {msg.step || "QUEUED"}
                              </strong>
                            </span>
                            <span className="font-mono text-[#d1d7e2]">{msg.progress || 10}%</span>
                          </div>
                          <div className="w-full bg-[#1e222a] h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${msg.progress || 10}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* 内容与产出 */}
                      <div className="text-sm text-[#dce1eb] whitespace-pre-wrap leading-relaxed pt-1 select-text">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isMe
                          ? "bg-indigo-600 text-white rounded-tr-none shadow-sm"
                          : "bg-[#1c1f26] border border-[#272c36] text-[#dce1eb] rounded-tl-none"
                      }`}
                    >
                      {msg.content}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* ================= 底部输入与快捷指派区域 ================= */}
        <div className="p-4 border-t border-[#22262f] bg-[#121417]/95 relative">
          <div className="max-w-3xl mx-auto space-y-2 relative">
            {/* Mention 浮动下拉菜单 */}
            <MentionDropdown
              isOpen={isMentionOpen}
              agents={agents}
              filterQuery={mentionFilter}
              selectedIndex={mentionIndex}
              onSelect={handleSelectAgent}
              onClose={() => setIsMentionOpen(false)}
            />

            {/* 顶部指示条 */}
            <div className="flex items-center justify-between text-xs pb-1 overflow-x-auto">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isDirectChat && directTargetAgent ? (
                  <span className="text-[11px] text-[#8a94a4] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>正与</span>
                    <strong className="text-indigo-300">@{directTargetAgent.id}</strong>
                    <span>单独对话，直接输入即可分派</span>
                  </span>
                ) : (
                  <>
                    <span className="text-[#646d7d] flex items-center gap-1 mr-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span>快捷指派:</span>
                    </span>
                    {agents.map((ag) => {
                      const isBusy = ag.isOnline && !!ag.activeTask;
                      const avatar = getAgentAvatarUrl(ag.avatar, ag.id);
                      return (
                        <div
                          key={ag.id}
                          className="inline-flex items-center gap-1 bg-[#1a1d24] border border-[#262c36] hover:border-[#384050] rounded-full px-2 py-0.5 transition-all text-[#c4cbd5]"
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectAgent(ag)}
                            className="flex items-center gap-1.5 text-xs"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={avatar} alt="" className="w-3 h-3 rounded object-cover" />
                            <span>@{ag.id}</span>
                          </button>
                          <AgentStatusPopover agent={ag} side="top" className="ml-0.5" />
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* 目标指示与优先级 */}
              <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                {!isDirectChat && detectedTargetAgent && (
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-700/40 flex items-center gap-1">
                    <span>目标:</span>
                    <strong className="text-white">@{detectedTargetAgent.id}</strong>
                  </span>
                )}

                <select
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="bg-[#181a20] border border-[#272b35] text-[#8690a0] text-[11px] rounded-lg px-2 py-0.5 focus:outline-none focus:border-indigo-500"
                  title="调度优先级"
                >
                  <option value={0}>普通</option>
                  <option value={1}>高优</option>
                  <option value={2}>紧急</option>
                </select>
              </div>
            </div>

            {/* 主输入框 */}
            <div className="relative flex items-end gap-2 bg-[#1a1d24] border border-[#292f3a] rounded-2xl p-2 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all shadow-inner">
              {!isDirectChat && (
                <button
                  type="button"
                  onClick={handleTriggerMention}
                  className={`p-2 rounded-xl transition-colors flex items-center gap-1 text-xs font-medium flex-shrink-0 ${
                    isMentionOpen
                      ? "bg-indigo-600 text-white"
                      : "text-[#7b8595] hover:text-[#d3d9e4] hover:bg-[#232731]"
                  }`}
                  title="选择 Agent"
                >
                  <AtSign className="w-4 h-4" />
                  <span className="hidden sm:inline">指派</span>
                </button>
              )}

              <textarea
                ref={textareaRef}
                rows={1}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  isDirectChat
                    ? `给 @${directTargetAgent?.id || "muse"} 发送任务或对话，按 Enter 发送...`
                    : "输入消息，或输入 @ 快速指派特定 Muse 智能体..."
                }
                className="flex-1 bg-transparent border-0 resize-none py-1.5 px-2 text-sm text-[#e3e7ed] placeholder-[#5d6676] focus:outline-none max-h-32 leading-relaxed"
                style={{ minHeight: "38px" }}
              />

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isSending}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white p-2.5 rounded-xl flex items-center justify-center transition-all flex-shrink-0 shadow-sm"
                title="发送"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
