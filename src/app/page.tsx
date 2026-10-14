"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Send,
  Bot,
  User,
  CheckCircle2,
  Clock,
  AlertCircle,
  Activity,
  Layers,
  Sparkles,
  Wifi,
  WifiOff,
  LogOut,
  Plus,
  Settings,
  Trash2,
  AtSign,
  Copy,
  Check,
  FileText,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { appConfig, apiFetch } from "@/lib/config";
import AgentRegisterModal from "@/components/AgentRegisterModal";
import AgentConfigModal from "@/components/AgentConfigModal";
import MentionDropdown, { AgentItem } from "@/components/MentionDropdown";

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
}

export default function ChatHubPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [priority, setPriority] = useState<number>(0); // 0: 普通, 1: 高优, 2: 紧急

  // 弹窗状态
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  // @ 下拉状态
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. 初始化会话与 Agent 列表
  useEffect(() => {
    fetchConversations();
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. 监听全局 SSE 事件 (实时接收 Agent 进度与状态)
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
        } else if (data.type === "AGENT_STATUS_CHANGE") {
          fetchAgents();
        }
      } catch {
        // 忽略 SSE 消息解析异常
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

  // 删除 Agent
  async function handleDeleteAgent(agentId: string, agentName: string) {
    if (!window.confirm(`确定要注销并删除智能体【${agentName} (@${agentId})】吗？`)) {
      return;
    }
    const res = await apiFetch(`/api/agents?id=${agentId}`, { method: "DELETE" });
    if (res.error) {
      alert(`删除失败: ${res.error}`);
    } else {
      fetchAgents();
    }
  }

  // 复制 Agent Token
  function handleCopyToken(token: string, agentId: string) {
    navigator.clipboard.writeText(token);
    setCopiedTokenId(agentId);
    setTimeout(() => setCopiedTokenId(null), 2000);
  }

  // 处理输入框文本变化及 @ 检测
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    const cursor = e.target.selectionStart || 0;
    setInputValue(val);

    // 寻找光标前最近的一个 @ 符号
    const textBeforeCursor = val.slice(0, cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      // 检查 @ 之前是否是空格或开头，防止误判邮箱等
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : " ";
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);

      // 只要后面没有空格，就认为是正在输入的 @ 过滤词
      if ((/\s/.test(charBeforeAt) || lastAtIndex === 0) && !/\s/.test(textAfterAt)) {
        setMentionFilter(textAfterAt);
        setIsMentionOpen(true);
        setMentionIndex(0);
        return;
      }
    }

    setIsMentionOpen(false);
  }

  // 点击快捷 @ 按钮唤出下拉菜单
  function handleTriggerMention() {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursor = textarea.selectionStart || inputValue.length;
    const prefix = inputValue.slice(0, cursor);
    const suffix = inputValue.slice(cursor);

    // 如果光标前不是空格且不为空，补一个空格
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

  // 选中某一个 Agent 填入输入框
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

  // 键盘导航：上下键选择、回车确认、Shift+Enter换行
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // 1. 下拉菜单打开时的按键拦截
    if (isMentionOpen) {
      // 过滤出匹配的 Agent
      const filtered = agents
        .filter((ag) => {
          const q = mentionFilter.toLowerCase().trim();
          if (!q) return true;
          return (
            ag.id.toLowerCase().includes(q) ||
            (ag.name && ag.name.toLowerCase().includes(q))
          );
        })
        .sort((a, b) => {
          if (a.isOnline === b.isOnline) return 0;
          return a.isOnline ? -1 : 1;
        });

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

    // 2. 正常消息发送（Enter 发送，Shift+Enter 换行）
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  // 发送消息并派送任务
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
        if (userMessage) {
          setMessages((prev) => [...prev, userMessage]);
        }
        if (agentMessage) {
          setMessages((prev) => [...prev, agentMessage]);
        }
      }
    } catch (err) {
      console.error("发送异常:", err);
    } finally {
      setIsSending(false);
      // 保持焦点在输入框
      setTimeout(() => textareaRef.current?.focus(), 10);
    }
  }

  // 检测当前输入框中是否已指定目标 Agent
  const targetAgentMatch = inputValue.match(/@([a-zA-Z0-9_-]+)/);
  const detectedTargetAgent = targetAgentMatch
    ? agents.find((a) => a.id.toLowerCase() === targetAgentMatch[1].toLowerCase())
    : null;

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100 font-sans antialiased overflow-hidden">
      {/* 弹窗：注册新 Agent */}
      <AgentRegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={() => {
          fetchAgents();
        }}
      />

      {/* 弹窗：服务部署与网络配置中心 */}
      <AgentConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />

      {/* ================= 左侧侧边栏 ================= */}
      <aside className="w-80 border-r border-neutral-800 flex flex-col bg-neutral-900/40 select-none">
        {/* 顶部标题与设置 */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h1 className="font-semibold text-base tracking-tight text-neutral-100">
              Agent 调度中心
            </h1>
          </div>
          <button
            onClick={() => setIsConfigOpen(true)}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-indigo-400 hover:bg-neutral-800 transition-colors"
            title="服务连接与部署配置 (修改网关/API地址)"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* 会话列表 */}
        <div className="p-3">
          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider px-2 mb-2">
            任务讨论群
          </div>
          <div className="space-y-1">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center justify-between transition-colors ${
                  activeConvId === conv.id
                    ? "bg-indigo-600/20 text-indigo-300 font-medium border border-indigo-500/30"
                    : "hover:bg-neutral-800/60 text-neutral-300"
                }`}
              >
                <span className="truncate">{conv.title}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                  群聊
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Agent 智能体节点管理看板 */}
        <div className="mt-auto border-t border-neutral-800 bg-neutral-900/60 flex flex-col max-h-[50vh]">
          {/* 栏目标题与快速注册按钮 */}
          <div className="p-3.5 border-b border-neutral-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                智能体节点 ({agents.length})
              </span>
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            </div>

            <button
              onClick={() => setIsRegisterOpen(true)}
              className="text-xs px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1 transition-colors shadow-sm shadow-indigo-600/20"
              title="手动注册新 Agent 节点"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>注册</span>
            </button>
          </div>

          {/* Agent 滚动列表 */}
          <div className="overflow-y-auto p-3 space-y-2">
            {agents.length === 0 ? (
              <div className="text-center py-6 text-xs text-neutral-500">
                暂无节点，点击上方“注册”手动添加
              </div>
            ) : (
              agents.map((agent: AgentItem) => (
                <div
                  key={agent.id}
                  className="p-2.5 rounded-xl border border-neutral-800/80 bg-neutral-950/70 hover:border-neutral-700 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    {/* 左侧头像与名称 */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-semibold text-neutral-200">
                          {agent.id.slice(0, 2).toUpperCase()}
                        </div>
                        <span
                          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-neutral-950 ${
                            agent.isOnline
                              ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                              : "bg-neutral-500"
                          }`}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs font-medium flex items-center gap-1.5 truncate">
                          <span className="text-neutral-200 truncate">{agent.name}</span>
                          <span className="text-[11px] text-neutral-400 font-mono flex-shrink-0">
                            @{agent.id}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                          {agent.isOnline ? (
                            <span className="text-emerald-400 flex items-center gap-0.5 text-[10px]">
                              <Wifi className="w-3 h-3" /> 在线就绪
                            </span>
                          ) : (
                            <span className="text-neutral-500 flex items-center gap-0.5 text-[10px]">
                              <WifiOff className="w-3 h-3" /> 离线待连
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 右侧快捷操作按钮 */}
                    <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                      {/* 复制 Token */}
                      {agent.token && (
                        <button
                          onClick={() => agent.token && handleCopyToken(agent.token, agent.id)}
                          className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-amber-300 transition-colors"
                          title="复制接入 Token 密钥"
                        >
                          {copiedTokenId === agent.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}

                      {/* 派发按钮 */}
                      <button
                        onClick={() => handleSelectAgent(agent)}
                        className="text-[11px] px-2 py-1 rounded-md bg-neutral-800 hover:bg-indigo-600 hover:text-white text-neutral-300 transition-all font-medium"
                        title="在输入框中 @ 派发"
                      >
                        @ 派发
                      </button>

                      {/* 删除按钮 */}
                      <button
                        onClick={() => handleDeleteAgent(agent.id, agent.name)}
                        className="p-1.5 rounded-md hover:bg-rose-950/60 text-neutral-500 hover:text-rose-400 transition-colors"
                        title="注销此 Agent"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* ================= 右侧主聊天与派发区 ================= */}
      <main className="flex-1 flex flex-col bg-neutral-950">
        {/* 顶部群信息与工具条 */}
        <header className="h-14 border-b border-neutral-800 px-6 flex items-center justify-between bg-neutral-900/30 backdrop-blur">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-sm text-neutral-200">
              {conversations.find((c) => c.id === activeConvId)?.title || "群聊协作"}
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-950/80 text-indigo-400 border border-indigo-800/40">
              多 Muse 动态路由
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* 部署连接配置快捷入口 */}
            <button
              onClick={() => setIsConfigOpen(true)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-800 hover:bg-neutral-900 text-neutral-300 hover:text-white flex items-center gap-1.5 transition-colors"
              title="查看当前 WebSocket / API 部署接入配置"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-400" />
              <span>部署配置</span>
            </button>

            {/* 退出锁定 */}
            <button
              onClick={async () => {
                await apiFetch("/api/auth/logout", { method: "POST" });
                router.push("/login");
                router.refresh();
              }}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-800 hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200 flex items-center gap-1.5 transition-colors"
              title="锁定并退出"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>锁定</span>
            </button>
          </div>
        </header>

        {/* 消息滚动列表 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg) => {
            const isMe = msg.senderType === "USER";
            const isAgent = msg.senderType === "AGENT";
            const isSystem = msg.senderType === "SYSTEM";

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <div className="text-xs text-neutral-400 bg-neutral-900 px-3.5 py-1.5 rounded-full border border-neutral-800 shadow-sm">
                    {msg.content}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${isMe ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                {/* 头像 */}
                <div
                  className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold ${
                    isMe
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "bg-emerald-950 text-emerald-400 border border-emerald-800/50"
                  }`}
                >
                  {isMe ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* 消息体 */}
                <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <div className="text-xs text-neutral-400 mb-1 flex items-center gap-2">
                    <span className="font-medium text-neutral-300">{msg.senderName}</span>
                    <span className="text-[10px] text-neutral-500">
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Agent 任务处理卡片 */}
                  {isAgent && msg.taskId ? (
                    <div className="w-full min-w-[320px] sm:min-w-[420px] rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 space-y-3 shadow-lg backdrop-blur">
                      <div className="flex items-center justify-between text-xs pb-2 border-b border-neutral-800">
                        <div className="flex items-center gap-1.5 font-mono text-neutral-400">
                          <FileText className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{msg.taskId}</span>
                        </div>
                        <div>
                          {msg.status === "DONE" ? (
                            <span className="text-emerald-400 flex items-center gap-1 text-[11px] font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> 任务已完成
                            </span>
                          ) : msg.status === "FAILED" ? (
                            <span className="text-rose-400 flex items-center gap-1 text-[11px] font-medium">
                              <AlertCircle className="w-3.5 h-3.5" /> 处理失败
                            </span>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-1.5 text-[11px] font-medium">
                              <Clock className="w-3.5 h-3.5 animate-spin" /> 处理中...
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 进度条 */}
                      {msg.status !== "DONE" && (
                        <div className="space-y-1.5 bg-neutral-950/60 p-2.5 rounded-xl border border-neutral-800/60">
                          <div className="flex justify-between text-[11px] text-neutral-400">
                            <span className="flex items-center gap-1">
                              <span>当前阶段:</span>
                              <strong className="text-indigo-300 font-mono">
                                {msg.step || "QUEUED"}
                              </strong>
                            </span>
                            <span className="font-mono text-neutral-300">{msg.progress || 10}%</span>
                          </div>
                          <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-indigo-500 h-full rounded-full transition-all duration-300 shadow-sm shadow-indigo-500/50"
                              style={{ width: `${msg.progress || 10}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* 正文产物 */}
                      <div className="text-sm text-neutral-200 whitespace-pre-wrap leading-relaxed pt-1 select-text">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isMe
                          ? "bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/20"
                          : "bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-tl-none"
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

        {/* ================= 底部输入与 @ 派发区域 ================= */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/40 relative">
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

            {/* 顶部快捷条：目标提示 + 快捷 Agent 小药丸 */}
            <div className="flex items-center justify-between text-xs pb-1 overflow-x-auto">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-neutral-500 flex items-center gap-1 mr-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>快捷派送:</span>
                </span>
                {agents.map((ag) => (
                  <button
                    key={ag.id}
                    type="button"
                    onClick={() => handleSelectAgent(ag)}
                    className={`px-2 py-0.5 rounded-full border text-neutral-300 flex items-center gap-1 transition-all ${
                      ag.isOnline
                        ? "bg-neutral-800/80 border-emerald-500/30 hover:border-emerald-400 hover:bg-neutral-800 text-neutral-200"
                        : "bg-neutral-900/90 border-neutral-800 text-neutral-400 hover:bg-neutral-800"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        ag.isOnline ? "bg-emerald-400" : "bg-neutral-500"
                      }`}
                    />
                    <span>@{ag.id}</span>
                  </button>
                ))}
              </div>

              {/* 派发目标与优先级指示 */}
              <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                {detectedTargetAgent && (
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-950/90 text-indigo-300 border border-indigo-700/50 flex items-center gap-1 animate-in fade-in">
                    <span>目标:</span>
                    <strong className="text-white">@{detectedTargetAgent.id}</strong>
                    <span>({detectedTargetAgent.name})</span>
                  </span>
                )}

                {/* 优先级切换 */}
                <select
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="bg-neutral-900 border border-neutral-800 text-neutral-400 text-[11px] rounded-lg px-2 py-0.5 focus:outline-none focus:border-indigo-500"
                  title="任务调度优先级"
                >
                  <option value={0}>普通优先级</option>
                  <option value={1}>高优任务</option>
                  <option value={2}>紧急加塞</option>
                </select>
              </div>
            </div>

            {/* 输入框主容器 */}
            <div className="relative flex items-end gap-2 bg-neutral-900/90 border border-neutral-800 rounded-2xl p-2 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all shadow-inner">
              {/* 手动 @ 按钮 (点击直接唤起下拉菜单) */}
              <button
                type="button"
                onClick={handleTriggerMention}
                className={`p-2 rounded-xl transition-colors flex items-center gap-1 text-xs font-medium flex-shrink-0 ${
                  isMentionOpen
                    ? "bg-indigo-600 text-white"
                    : "text-neutral-400 hover:text-indigo-400 hover:bg-neutral-800"
                }`}
                title="手动 @ 选择 Agent"
              >
                <AtSign className="w-4 h-4" />
                <span className="hidden sm:inline">@ 派发</span>
              </button>

              {/* 多行输入文本框 */}
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="输入 @ 选择 Muse Agent 派发任务，按 Enter 发送，Shift+Enter 换行..."
                className="flex-1 bg-transparent border-0 resize-none py-1.5 px-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none max-h-32 leading-relaxed"
                style={{ minHeight: "38px" }}
              />

              {/* 发送按钮 */}
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isSending}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white p-2.5 rounded-xl flex items-center justify-center transition-all flex-shrink-0 shadow-md shadow-indigo-600/30"
                title="发送任务"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* 底部按键提示 */}
            <div className="flex items-center justify-between text-[11px] text-neutral-500 px-2 pt-0.5">
              <span>输入 <code>@</code> 或点击 <code>@ 派发</code> 自动呼出下拉菜单并派送任务</span>
              <span>Enter 发送 · Shift+Enter 换行</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
