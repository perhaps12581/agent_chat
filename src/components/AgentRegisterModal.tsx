"use client";

import React, { useState } from "react";
import {
  X,
  Plus,
  Key,
  Bot,
  Copy,
  Check,
  Sparkles,
  AlertCircle,
  Code2,
} from "lucide-react";
import { appConfig, apiFetch } from "@/lib/config";

interface RegisteredAgent {
  id: string;
  name: string;
  token: string;
  capabilities?: string[];
}

interface AgentRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AgentRegisterModal({
  isOpen,
  onClose,
  onSuccess,
}: AgentRegisterModalProps) {
  const [agentId, setAgentId] = useState("");
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [capabilities, setCapabilities] = useState("step_progress, artifacts_meta");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registeredAgent, setRegisteredAgent] = useState<RegisteredAgent | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  function generateToken() {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let rand = "";
    for (let i = 0; i < 24; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setToken(`agtk_live_${rand}`);
  }

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const cleanId = agentId.trim().toLowerCase();
    if (!cleanId) {
      setError("请输入 Agent ID 标识");
      return;
    }

    if (!/^[a-zA-Z0-9_-]{2,32}$/.test(cleanId)) {
      setError("ID 只能包含 2-32 位的英文、数字、下划线及中划线");
      return;
    }

    setLoading(true);

    try {
      const caps = capabilities
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      const res = await apiFetch<RegisteredAgent>("/api/agents", {
        method: "POST",
        body: JSON.stringify({
          id: cleanId,
          name: name.trim() || `${cleanId} 助手`,
          token: token.trim() || undefined,
          capabilities: caps,
        }),
      });

      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        setRegisteredAgent(res.data);
        onSuccess();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "注册失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setAgentId("");
    setName("");
    setToken("");
    setError("");
    setRegisteredAgent(null);
    onClose();
  }

  const wsUrl = appConfig.getWsUrl();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 顶部标题栏 */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-100 text-sm sm:text-base">
                {registeredAgent ? "Agent 注册成功" : "手动注册新 Agent 节点"}
              </h3>
              <p className="text-xs text-neutral-400">
                {registeredAgent
                  ? "请妥善保管接入密钥，并配置到您的 Muse 客户端中"
                  : "添加新的 Muse 智能体并生成通信鉴权密钥"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 主体区域 */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {registeredAgent ? (
            /* 注册成功指引面板 */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-medium text-sm">
                  <Check className="w-4 h-4" />
                  <span>Agent @{registeredAgent.id} 注册成功！</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  显示名称：<strong className="text-white">{registeredAgent.name}</strong>。
                  您现在可以在群聊中通过{" "}
                  <code className="text-emerald-300 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800/50">
                    @{registeredAgent.id}
                  </code>{" "}
                  直接唤醒并派送任务。
                </p>
              </div>

              {/* 关键连接配置 */}
              <div className="space-y-3 bg-neutral-950/70 p-4 rounded-xl border border-neutral-800">
                <div className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-indigo-400" />
                  <span>连接配置 (用于 Agent 进程接入)</span>
                </div>

                {/* WS URL */}
                <div>
                  <div className="text-[11px] text-neutral-400 mb-1">WebSocket 网关地址:</div>
                  <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-neutral-200">
                    <span className="truncate flex-1">{wsUrl}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(wsUrl, "wsUrl")}
                      className="text-neutral-400 hover:text-indigo-400 transition-colors"
                      title="复制地址"
                    >
                      {copiedKey === "wsUrl" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Token */}
                <div>
                  <div className="text-[11px] text-neutral-400 mb-1">通信 Token 密钥:</div>
                  <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-amber-300">
                    <span className="truncate flex-1">{registeredAgent.token}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(registeredAgent.token, "token")}
                      className="text-neutral-400 hover:text-indigo-400 transition-colors"
                      title="复制密钥"
                    >
                      {copiedKey === "token" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Header 示例 */}
                <div>
                  <div className="text-[11px] text-neutral-400 mb-1">请求头配置 (Headers):</div>
                  <pre className="bg-neutral-900 p-2.5 rounded-lg border border-neutral-800 text-[11px] font-mono text-neutral-300 overflow-x-auto">
{`Authorization: Bearer ${registeredAgent.token}
X-Agent-Id: ${registeredAgent.id}`}
                  </pre>
                </div>
              </div>

              {/* 快速测试脚本 */}
              <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-indigo-400" /> 快捷启动测试客户端
                  </span>
                  <button
                    onClick={() =>
                      handleCopy(
                        `AGENT_HUB_WS_URL="${wsUrl}" AGENT_HUB_ID="${registeredAgent.id}" AGENT_HUB_TOKEN="${registeredAgent.token}" npx tsx test-agent.ts`,
                        "cli"
                      )
                    }
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    {copiedKey === "cli" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>复制启动命令</span>
                  </button>
                </div>
                <div className="text-[11px] text-neutral-400 font-mono bg-neutral-900 p-2.5 rounded-lg border border-neutral-800 overflow-x-auto whitespace-pre-wrap">
                  {`AGENT_HUB_WS_URL="${wsUrl}" AGENT_HUB_ID="${registeredAgent.id}" AGENT_HUB_TOKEN="${registeredAgent.token}" npx tsx test-agent.ts`}
                </div>
              </div>
            </div>
          ) : (
            /* 注册表单 */
            <form id="agent-register-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Agent ID */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Agent ID (唯一标识符) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 font-mono text-sm">
                    @
                  </span>
                  <input
                    type="text"
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                    placeholder="例如：muse_writer, coder_bot, reviewer"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-4 py-2.5 text-sm font-mono text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">
                  用于在群聊中 @ 提及派发，仅支持小写字母、数字、下划线与中划线
                </p>
              </div>

              {/* Agent 名称 */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  显示名称 <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：文案创作专家、Python架构助手"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                />
              </div>

              {/* Token 密钥 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-neutral-300">
                    通信 Token (留空则自动生成)
                  </label>
                  <button
                    type="button"
                    onClick={generateToken}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>随机生成</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="留空自动生成 agtk_live_xxxx"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-mono text-amber-300 placeholder-neutral-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* 能力标签 */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  能力特长标签 (逗号分隔)
                </label>
                <input
                  type="text"
                  value={capabilities}
                  onChange={(e) => setCapabilities(e.target.value)}
                  placeholder="step_progress, artifacts_meta, code_review"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </form>
          )}
        </div>

        {/* 底部按钮栏 */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950/50 flex items-center justify-end gap-3">
          {registeredAgent ? (
            <button
              type="button"
              onClick={handleClose}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-5 py-2.5 rounded-xl font-medium transition-colors"
            >
              完成并关闭
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                form="agent-register-form"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-indigo-600/20"
              >
                {loading ? "注册中..." : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>立即注册 Agent</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
