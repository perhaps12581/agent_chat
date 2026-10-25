"use client";

import React, { useState } from "react";
import { X, Save, FileText, Bot, Key } from "lucide-react";
import { AgentItem } from "./MentionDropdown";
import { getAgentAvatarUrl } from "@/lib/avatars";

interface AgentProfileModalProps {
  agent: AgentItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (agentId: string, name: string, description: string, token?: string) => Promise<void>;
}

export default function AgentProfileModal({
  agent,
  isOpen,
  onClose,
  onSave,
}: AgentProfileModalProps) {
  const [name, setName] = useState(agent?.name || "");
  const [description, setDescription] = useState(agent?.description || "");
  const [token, setToken] = useState(agent?.token || "");
  const [saving, setSaving] = useState(false);

  // 当外部选中的 agent 改变时同步表单
  React.useEffect(() => {
    if (agent) {
      setName(agent.name || "");
      setDescription(agent.description || "");
      setToken(agent.token || "");
    }
  }, [agent]);

  if (!isOpen || !agent) return null;

  async function handleSave() {
    if (!agent) return;
    setSaving(true);
    try {
      await onSave(agent.id, name.trim(), description.trim(), token.trim() || undefined);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const avatarUrl = getAgentAvatarUrl(agent.avatar, agent.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#181a21] border border-[#2b303c] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* 顶部标题栏 */}
        <div className="px-5 py-3.5 border-b border-[#242833] flex items-center justify-between bg-[#13151a]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-medium text-[#e2e6eb] text-sm">编辑智能体资料</h3>
              <p className="text-[11px] text-[#717b8b]">修改名称备注与职责工作描述</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#747e8f] hover:text-[#d3d9e4] hover:bg-[#20242e] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 主体表单 */}
        <div className="p-5 space-y-4 text-xs">
          {/* 头像与标识概览 */}
          <div className="flex items-center gap-3 p-3 bg-[#13151a] rounded-xl border border-[#242833]">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#20252e] border border-[#2f3542] flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[#c4cbd5] font-semibold text-xs">
                @{agent.id}
              </div>
              <div className="text-[10px] text-[#697282] mt-0.5">
                节点连接 ID (系统唯一主键)
              </div>
            </div>
          </div>

          {/* 名称字段 */}
          <div>
            <label className="block font-medium text-[#8d98a8] mb-1">
              展示名称 / 备注标签
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：Muse 1号机"
              className="w-full bg-[#121418] border border-[#262a34] rounded-xl px-3 py-2 text-xs text-[#e1e5eb] placeholder-[#576070] focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* 描述字段 (核心需求) */}
          <div>
            <label className="block font-medium text-[#8d98a8] mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>职责描述 / 工作内容设定</span>
              </span>
              <span className="text-[10px] text-[#697282]">展示在列表与单聊标题</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：专职B站短视频脚本策划、数据分发与多媒体生成..."
              className="w-full bg-[#121418] border border-[#262a34] rounded-xl p-3 text-xs text-[#e1e5eb] placeholder-[#576070] focus:outline-none focus:border-indigo-500 transition-colors resize-none leading-relaxed"
            />
          </div>

          {/* API Key / 接入 Token 字段 */}
          <div>
            <label className="block font-medium text-[#8d98a8] mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>{agent.id === "gemini" ? "大模型 API Key (sk-...)" : "节点接入 Token"}</span>
              </span>
            </label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={agent.id === "gemini" ? "sk-..." : "agtk_live_..."}
              className="w-full bg-[#121418] border border-[#262a34] rounded-xl px-3 py-2 text-xs font-mono text-amber-300 placeholder-[#576070] focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="p-4 border-t border-[#232731] bg-[#13151a] flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#2a303c] text-xs text-[#828c9c] hover:bg-[#1c1f26] transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-medium text-white transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "保存中..." : "保存修改"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
