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
} from "lucide-react";

interface Agent {
  id: string;
  name: string;
  status: string;
  isOnline: boolean;
  capabilities: any;
}

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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. 加载会话列表和 Agent 列表
  useEffect(() => {
    fetchConversations();
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000);
    return () => clearInterval(interval);
  }, []);

  // 2. 监听全局 SSE 事件 (实时接收 Agent 进度与状态)
  useEffect(() => {
    const eventSource = new EventSource("/api/events");

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
      } catch (err) {}
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // 3. 当选中的会话改变时加载历史消息
  useEffect(() => {
    if (activeConvId) {
      fetchMessages(activeConvId);
    }
  }, [activeConvId]);

  // 自动滚到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchConversations() {
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setConversations(data);
        if (!activeConvId) {
          setActiveConvId(data[0].id);
        }
      }
    } catch (e) {}
  }

  async function fetchAgents() {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      if (Array.isArray(data)) setAgents(data);
    } catch (e) {}
  }

  async function fetchMessages(convId: string) {
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      const data = await res.json();
      if (Array.isArray(data)) setMessages(data);
    } catch (e) {}
  }

  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!inputValue.trim() || !activeConvId || isSending) return;

    const text = inputValue;
    setInputValue("");
    setIsSending(true);

    try {
      const res = await fetch(`/api/conversations/${activeConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();

      if (data.userMessage) {
        setMessages((prev) => [...prev, data.userMessage]);
      }
      if (data.agentMessage) {
        setMessages((prev) => [...prev, data.agentMessage]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100 font-sans antialiased overflow-hidden">
      {/* 左侧侧边栏：会话与 Agent 状态 */}
      <aside className="w-80 border-r border-neutral-800 flex flex-col bg-neutral-900/40">
        {/* 顶部标题 */}
        <div className="p-4 border-b border-neutral-800 flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          <h1 className="font-semibold text-lg tracking-tight">Agent Hub 调度中心</h1>
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

        {/* Agent 状态监视看板 */}
        <div className="mt-auto p-4 border-t border-neutral-800 bg-neutral-900/60">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              智能体节点 (WSS v1.1)
            </span>
            <Activity className="w-3.5 h-3.5 text-neutral-400 animate-pulse" />
          </div>

          <div className="space-y-2.5">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="p-2.5 rounded-lg border border-neutral-800 bg-neutral-950/60 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-semibold text-neutral-200">
                      {agent.id.slice(0, 2).toUpperCase()}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-neutral-950 ${
                        agent.isOnline ? "bg-emerald-500" : "bg-neutral-500"
                      }`}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-medium flex items-center gap-1.5">
                      <span>{agent.name}</span>
                      <span className="text-[10px] text-neutral-400 uppercase">
                        @{agent.id}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-400 flex items-center gap-1 mt-0.5">
                      {agent.isOnline ? (
                        <span className="text-emerald-400 flex items-center gap-0.5">
                          <Wifi className="w-3 h-3" /> 在线就绪
                        </span>
                      ) : (
                        <span className="text-neutral-500 flex items-center gap-0.5">
                          <WifiOff className="w-3 h-3" /> 离线待连
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setInputValue(`@${agent.id} `)}
                  className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                >
                  派发
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* 右侧主聊天区 */}
      <main className="flex-1 flex flex-col bg-neutral-950">
        {/* 顶部群信息 */}
        <header className="h-14 border-b border-neutral-800 px-6 flex items-center justify-between bg-neutral-900/20 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <h2 className="font-medium text-sm text-neutral-200">
              {conversations.find((c) => c.id === activeConvId)?.title || "群聊协作"}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800/40">
              多 Agent 自动路由
            </span>
          </div>

          <div className="text-xs text-neutral-400 flex items-center gap-2">
            <span>支持指令：</span>
            <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-300">@muse</code>
            <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-300">@dot</code>
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
                  <div className="text-xs text-neutral-400 bg-neutral-900 px-3 py-1.5 rounded-full border border-neutral-800">
                    {msg.content}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-2xl ${isMe ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                {/* 头像 */}
                <div
                  className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold ${
                    isMe
                      ? "bg-indigo-600 text-white"
                      : "bg-emerald-950 text-emerald-400 border border-emerald-800/50"
                  }`}
                >
                  {isMe ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* 消息内容体 */}
                <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <div className="text-xs text-neutral-400 mb-1 flex items-center gap-1.5">
                    <span>{msg.senderName}</span>
                    <span className="text-[10px] text-neutral-500">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {/* 普通文本 or Agent 任务步骤卡片 */}
                  {isAgent && msg.taskId ? (
                    <div className="w-full min-w-[320px] rounded-xl border border-neutral-800 bg-neutral-900/70 p-3.5 space-y-2.5 shadow-sm">
                      <div className="flex items-center justify-between text-xs pb-2 border-b border-neutral-800">
                        <span className="font-mono text-neutral-400">{msg.taskId}</span>
                        <div className="flex items-center gap-1">
                          {msg.status === "DONE" ? (
                            <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> 已完成
                            </span>
                          ) : msg.status === "FAILED" ? (
                            <span className="text-rose-400 flex items-center gap-1 text-[11px]">
                              <AlertCircle className="w-3.5 h-3.5" /> 失败
                            </span>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-1 text-[11px]">
                              <Clock className="w-3.5 h-3.5 animate-spin" /> 处理中
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 进度条 */}
                      {msg.status !== "DONE" && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-neutral-400">
                            <span>当前阶段: {msg.step || "QUEUED"}</span>
                            <span>{msg.progress || 10}%</span>
                          </div>
                          <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${msg.progress || 10}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* 内容/产出正文 */}
                      <div className="text-sm text-neutral-200 whitespace-pre-wrap leading-relaxed pt-1">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isMe
                          ? "bg-indigo-600 text-white rounded-tr-none"
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

        {/* 底部输入框 */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/30">
          <div className="max-w-3xl mx-auto space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInputValue((prev) => `@muse ${prev}`)}
                className="text-xs px-2.5 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center gap-1 transition-colors"
              >
                <Sparkles className="w-3 h-3 text-amber-400" /> @muse
              </button>
              <button
                type="button"
                onClick={() => setInputValue((prev) => `@dot ${prev}`)}
                className="text-xs px-2.5 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center gap-1 transition-colors"
              >
                <Sparkles className="w-3 h-3 text-blue-400" /> @dot
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="在群里发送消息，例如：@muse 帮我审查这个接口架构..."
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 text-neutral-200 placeholder-neutral-500 transition-colors"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isSending}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 rounded-xl flex items-center justify-center transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
