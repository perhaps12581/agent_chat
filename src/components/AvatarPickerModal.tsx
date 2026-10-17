"use client";

import React, { useState } from "react";
import { X, Check, Image as ImageIcon, Sparkles, ExternalLink } from "lucide-react";
import { AVATAR_OPTIONS, AvatarOption } from "@/lib/avatars";

interface AvatarPickerModalProps {
  isOpen: boolean;
  agentId: string;
  agentName: string;
  currentAvatar?: string | null;
  onClose: () => void;
  onSave: (avatarUrlOrId: string) => Promise<void>;
}

export default function AvatarPickerModal({
  isOpen,
  agentId,
  agentName,
  currentAvatar,
  onClose,
  onSave,
}: AvatarPickerModalProps) {
  const [selectedAvatar, setSelectedAvatar] = useState<string>(currentAvatar || "");
  const [customUrl, setCustomUrl] = useState<string>(
    currentAvatar?.startsWith("http") ? currentAvatar : ""
  );
  const [activeTab, setActiveTab] = useState<"preset" | "custom">("preset");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  async function handleConfirm() {
    setSaving(true);
    try {
      const finalAvatar = activeTab === "custom" && customUrl.trim() ? customUrl.trim() : selectedAvatar;
      await onSave(finalAvatar);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#181a21] border border-[#2b303c] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 顶部标题栏 */}
        <div className="px-5 py-3.5 border-b border-[#242833] flex items-center justify-between bg-[#13151a]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-medium text-[#e2e6eb] text-sm">
                设置智能体形象头像
              </h3>
              <p className="text-[11px] text-[#717b8b]">
                为 @{agentId} ({agentName}) 自定义精美形象
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#747e8f] hover:text-[#d3d9e4] hover:bg-[#20242e] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex px-5 pt-3 border-b border-[#222630] gap-4 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("preset")}
            className={`pb-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === "preset"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-[#7d8797] hover:text-[#bac3d2]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Google / 极客精选形象</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("custom")}
            className={`pb-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === "custom"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-[#7d8797] hover:text-[#bac3d2]"
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>自定义图片 URL</span>
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-5 overflow-y-auto space-y-4">
          {activeTab === "preset" ? (
            <div className="space-y-4">
              {/* 分组展示 */}
              <div>
                <div className="text-[11px] font-medium text-[#848e9e] uppercase tracking-wider mb-2">
                  Notion 极客极简系列
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-2.5">
                  {AVATAR_OPTIONS.filter((a) => a.category === "notion").map((opt) => (
                    <AvatarCard
                      key={opt.id}
                      option={opt}
                      isSelected={selectedAvatar === opt.id || selectedAvatar === opt.url}
                      onSelect={() => setSelectedAvatar(opt.id)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-[#848e9e] uppercase tracking-wider mb-2">
                  Bottts 现代智能机器人系列
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-2.5">
                  {AVATAR_OPTIONS.filter((a) => a.category === "bottts").map((opt) => (
                    <AvatarCard
                      key={opt.id}
                      option={opt}
                      isSelected={selectedAvatar === opt.id || selectedAvatar === opt.url}
                      onSelect={() => setSelectedAvatar(opt.id)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-[#848e9e] uppercase tracking-wider mb-2">
                  Google Material 几何棱镜系列
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                  {AVATAR_OPTIONS.filter((a) => a.category === "shapes").map((opt) => (
                    <AvatarCard
                      key={opt.id}
                      option={opt}
                      isSelected={selectedAvatar === opt.id || selectedAvatar === opt.url}
                      onSelect={() => setSelectedAvatar(opt.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <label className="block text-xs font-medium text-[#8d98a8]">
                输入任意网络图片或 SVG 地址
              </label>
              <input
                type="url"
                value={customUrl}
                onChange={(e) => {
                  setCustomUrl(e.target.value);
                  setSelectedAvatar(e.target.value);
                }}
                placeholder="https://example.com/avatar.png"
                className="w-full bg-[#121418] border border-[#262a34] rounded-xl px-3 py-2.5 text-xs text-[#e1e5eb] placeholder-[#576070] focus:outline-none focus:border-indigo-500 font-mono"
              />
              {customUrl && (
                <div className="flex items-center gap-3 p-3 bg-[#121418] rounded-xl border border-[#242933]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={customUrl}
                    alt="Preview"
                    className="w-12 h-12 rounded-xl object-cover bg-[#1c2027] border border-[#2f3542]"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <div className="text-[11px] text-[#7d8797]">
                    预览展示效果。支持 PNG、JPG、WebP 或 SVG。
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部按钮栏 */}
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
            onClick={handleConfirm}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-medium text-white transition-colors shadow-sm"
          >
            {saving ? "保存中..." : "保存形象"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AvatarCard({
  option,
  isSelected,
  onSelect,
}: {
  option: AvatarOption;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`relative p-2 rounded-xl cursor-pointer flex flex-col items-center gap-1.5 transition-all group ${
        isSelected
          ? "bg-indigo-600/20 border-2 border-indigo-500 shadow-sm"
          : "bg-[#14161b] border border-[#242833] hover:border-[#384050] hover:bg-[#1a1d24]"
      }`}
    >
      <div className="w-11 h-11 rounded-lg overflow-hidden bg-[#20252e] flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={option.url}
          alt={option.label}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <span className="text-[10px] text-[#9ca6b5] group-hover:text-[#d3d9e4] truncate max-w-full text-center">
        {option.label}
      </span>
      {isSelected && (
        <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-white">
          <Check className="w-2.5 h-2.5" />
        </span>
      )}
    </div>
  );
}
