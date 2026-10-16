"use client";

import React, { useState } from "react";
import {
  X,
  Key,
  Bot,
  Copy,
  Check,
  AlertCircle,
  Code2,
} from "lucide-react";
import { appConfig, apiFetch } from "@/lib/config";
import { AVATAR_OPTIONS } from "@/lib/avatars";

interface RegisteredAgent {
  id: string;
  name: string;
  avatar?: string | null;
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
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState(AVATAR_OPTIONS[0].id);
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
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await apiFetch<RegisteredAgent>("/api/agents", {
        method: "POST",
        body: JSON.stringify({
          id: cleanId,
          name: name.trim() || undefined,
          description: description.trim() || undefined,
          avatar: avatar || undefined,
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
    setAvatar(AVATAR_OPTIONS[0].id);
    setToken("");
    setError("");
    setRegisteredAgent(null);
    onClose();
  }

  const wsUrl = appConfig.getWsUrl();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#181a21] border border-[#272b36] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 顶部标题栏 */}
        <div className="px-5 py-3.5 border-b border-[#242833] flex items-center justify-between bg-[#13151a]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Bot className="w-4 h-4" />
            </div>
            <h3 className="font-medium text-[#e2e6eb] text-sm">
              {registeredAgent ? "节点注册就绪" : "添加智能体节点"}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-[#747e8f] hover:text-[#d3d9e4] hover:bg-[#20242e] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 主体区域 */}
        <div className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {registeredAgent ? (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-800/30 space-y-1.5">
                <div className="text-xs font-medium text-emerald-300">
                  已成功添加节点 @{registeredAgent.id} ({registeredAgent.name})
                </div>
                <div className="text-[11px] text-[#8692a2]">
                  请将下方 Token 填入该 Muse 机器的 token 凭据文件中。
                </div>
              </div>

              {/* Token 复制 */}
              <div>
                <label className="block text-xs font-medium text-[#8892a2] mb-1">
                  接入 Token
                </label>
                <div className="flex items-center gap-2 bg-[#121418] border border-[#242832] rounded-lg px-2.5 py-1.5 text-xs font-mono text-amber-300">
                  <span className="truncate flex-1">{registeredAgent.token}</span>
                  <button
                    onClick={() => handleCopy(registeredAgent.token, "token")}
                    className="text-[#7d8797] hover:text-indigo-400 transition-colors"
                  >
                    {copiedKey === "token" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* 快速配置示例 */}
              <div>
                <label className="block text-xs font-medium text-[#8892a2] mb-1 flex items-center gap-1">
                  <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Muse config.json 片段</span>
                </label>
                <pre className="p-3 rounded-xl bg-[#121418] border border-[#242832] text-[11px] font-mono text-[#abb5c4] overflow-x-auto leading-relaxed">
{`{
  "agent_id": "${registeredAgent.id}",
  "ws_url": "${wsUrl}",
  "token_file": "state/token",
  "proxy": "env"
}`}
                </pre>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-colors"
              >
                完成
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[#8892a2] mb-1">
                  Agent ID (英文/数字，如 muse5) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="例如 muse_backend 或 muse5"
                  className="w-full bg-[#121418] border border-[#262a34] rounded-xl px-3 py-2 text-xs text-[#e1e5eb] placeholder-[#576070] focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8892a2] mb-1">
                  显示名称 / 备注
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如 Muse 5号机 (备用)"
                  className="w-full bg-[#121418] border border-[#262a34] rounded-xl px-3 py-2 text-xs text-[#e1e5eb] placeholder-[#576070] focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8892a2] mb-1">
                  智能体职责描述 (工作内容与专长)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="例如：专职爬虫采集、自动化脚本与数据预处理"
                  className="w-full bg-[#121418] border border-[#262a34] rounded-xl px-3 py-2 text-xs text-[#e1e5eb] placeholder-[#576070] focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
                />
              </div>

              {/* 形象头像快速选择 */}
              <div>
                <label className="block text-xs font-medium text-[#8892a2] mb-1.5">
                  选择初始形象头像
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {AVATAR_OPTIONS.slice(0, 6).map((opt) => (
                    <div
                      key={opt.id}
                      onClick={() => setAvatar(opt.id)}
                      className={`p-1.5 rounded-xl cursor-pointer flex items-center justify-center border transition-all ${
                        avatar === opt.id
                          ? "bg-indigo-600/20 border-indigo-500"
                          : "bg-[#14161b] border-[#252932] hover:border-[#384050]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={opt.url}
                        alt={opt.label}
                        className="w-8 h-8 rounded-lg object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-[#8892a2]">
                    接入 Token (留空自动生成)
                  </label>
                  <button
                    type="button"
                    onClick={generateToken}
                    className="text-[11px] text-indigo-400 hover:underline flex items-center gap-0.5"
                  >
                    <Key className="w-3 h-3" />
                    <span>随机生成</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="留空则系统自动随机生成"
                  className="w-full bg-[#121418] border border-[#262a34] rounded-xl px-3 py-2 text-xs text-[#e1e5eb] font-mono placeholder-[#576070] focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2 rounded-xl border border-[#282d38] text-xs text-[#828c9c] hover:bg-[#1a1d23] transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-medium text-white transition-colors"
                >
                  {loading ? "创建中..." : "确认添加"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
