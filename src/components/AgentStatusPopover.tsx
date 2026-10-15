"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Activity,
  CheckCircle2,
  Moon,
  Clock,
  Layers,
  Sparkles,
  Zap,
} from "lucide-react";
import { AgentItem } from "./MentionDropdown";
import { getAgentAvatarUrl } from "@/lib/avatars";

interface AgentStatusPopoverProps {
  agent: AgentItem;
  className?: string;
  side?: "right" | "top" | "bottom";
}

export default function AgentStatusPopover({
  agent,
  className = "",
  side = "right",
}: AgentStatusPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const activeTask = agent.activeTask;
  const isBusy = agent.isOnline && !!activeTask;
  const isOnline = agent.isOnline;
  const avatarUrl = getAgentAvatarUrl(agent.avatar, agent.id);

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // 浮窗位置计算类名
  const positionClasses = {
    right: "left-full top-1/2 -translate-y-1/2 ml-2.5",
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  }[side];

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 悬浮触发的小 Icon */}
      <button
        type="button"
        aria-label="查看智能体当前状态与工作内容"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`p-1 rounded-md transition-all flex items-center justify-center cursor-pointer ${
          isBusy
            ? "text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 ring-1 ring-amber-400/30"
            : isOnline
            ? "text-emerald-400/90 bg-emerald-400/10 hover:bg-emerald-400/20"
            : "text-neutral-500 bg-neutral-800/60 hover:bg-neutral-800"
        }`}
      >
        {isBusy ? (
          <Activity className="w-3.5 h-3.5 animate-pulse" />
        ) : isOnline ? (
          <CheckCircle2 className="w-3.5 h-3.5" />
        ) : (
          <Moon className="w-3.5 h-3.5" />
        )}
      </button>

      {/* 悬浮气泡浮层 (Tooltip / Popover) */}
      {isOpen && (
        <div
          className={`absolute ${positionClasses} z-50 w-72 p-3.5 rounded-xl border border-[#2d333f] bg-[#1a1d24]/95 text-[#e1e5eb] shadow-xl backdrop-blur-md text-xs select-none pointer-events-auto transition-all animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* 顶部标题行 */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#292e39]">
            <div className="flex items-center gap-2 font-medium min-w-0">
              <div className="w-5 h-5 rounded-md overflow-hidden bg-[#20252e] flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarUrl}
                  alt={agent.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-[#e2e6ec] font-semibold truncate">{agent.name}</span>
              <span className="text-[11px] font-mono text-[#8c96a5] flex-shrink-0">@{agent.id}</span>
            </div>

            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${
                isBusy
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : isOnline
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : "bg-neutral-800 text-neutral-400"
              }`}
            >
              {isBusy ? "执行中" : isOnline ? "空闲就绪" : "离线"}
            </span>
          </div>

          {/* 中间核心：工作内容详情 */}
          {isBusy && activeTask ? (
            <div className="space-y-2.5">
              <div className="bg-[#14161b] p-2.5 rounded-lg border border-[#262b35] space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-[#8e98a8]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>当前任务</span>
                  </span>
                  <span className="font-mono text-[10px] text-[#6b7585]">
                    {activeTask.taskId.slice(-8)}
                  </span>
                </div>
                <p className="text-[#d8dde6] line-clamp-2 leading-relaxed text-[11px]">
                  {activeTask.prompt}
                </p>
              </div>

              {/* 进度与阶段 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#8e98a8] flex items-center gap-1">
                    <Zap className="w-3 h-3 text-indigo-400" />
                    <span>阶段: {activeTask.step || "RUNNING"}</span>
                  </span>
                  <span className="font-mono text-amber-300 font-medium">
                    {activeTask.progress || 15}%
                  </span>
                </div>
                <div className="w-full bg-[#121418] h-1.5 rounded-full overflow-hidden border border-[#22262f]">
                  <div
                    className="bg-amber-400 h-full rounded-full transition-all duration-300"
                    style={{ width: `${activeTask.progress || 15}%` }}
                  />
                </div>
              </div>
            </div>
          ) : isOnline ? (
            <div className="py-1 text-[#8e98a8] space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-400/90">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="font-medium text-[11px]">节点空闲，随时可派发</span>
              </div>
              <p className="text-[11px] text-[#6f7887] leading-relaxed">
                在单聊中发送任意内容，或在群聊中输入 @{agent.id} 即可指派任务。
              </p>
            </div>
          ) : (
            <div className="py-1 text-[#6f7887] space-y-1">
              <p className="text-[11px] leading-relaxed">
                节点长连接已断开。请在 Muse 运行环境中执行客户端脚本自动连接。
              </p>
            </div>
          )}

          {/* 底部特性标签 */}
          {Array.isArray(agent.capabilities) && agent.capabilities.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-[#252a34] flex items-center gap-1 text-[10px] text-[#6e7786]">
              <Layers className="w-3 h-3 text-[#586170]" />
              <span className="truncate">能力: {agent.capabilities.join(", ")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
