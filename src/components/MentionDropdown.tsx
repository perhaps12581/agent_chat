"use client";

import React, { useEffect, useRef } from "react";
import { Wifi, WifiOff, Sparkles, Activity } from "lucide-react";

export interface ActiveTaskInfo {
  taskId: string;
  prompt: string;
  status: string;
  step?: string | null;
  progress?: number | null;
  priority?: number;
  updatedAt?: string;
}

export interface AgentItem {
  id: string;
  name: string;
  token?: string;
  status: string;
  isOnline: boolean;
  isBusy?: boolean;
  activeTask?: ActiveTaskInfo | null;
  statusSummary?: string;
  capabilities?: string[] | null;
}

interface MentionDropdownProps {
  isOpen: boolean;
  agents: AgentItem[];
  filterQuery: string;
  selectedIndex: number;
  onSelect: (agent: AgentItem) => void;
  onClose?: () => void;
}

export default function MentionDropdown({
  isOpen,
  agents,
  filterQuery,
  selectedIndex,
  onSelect,
}: MentionDropdownProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // 1. 过滤与排序：在线优先，根据 id 或 name 模糊匹配
  const filteredAgents = agents
    .filter((ag) => {
      const q = filterQuery.toLowerCase().trim();
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

  // 自动滚动到选中的项
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector(
      `[data-index="${selectedIndex}"]`
    ) as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen || filteredAgents.length === 0) {
    return null;
  }

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 mb-2 w-80 max-w-[92vw] bg-[#1a1d24]/95 border border-[#2c323e] rounded-xl shadow-2xl backdrop-blur-md overflow-hidden z-40 text-xs animate-in fade-in slide-in-from-bottom-1 duration-150"
    >
      {/* 极简顶栏 */}
      <div className="px-3 py-1.5 border-b border-[#262b36] bg-[#14161b]/80 flex items-center justify-between text-[11px] text-[#8e98a8]">
        <span className="flex items-center gap-1 font-medium text-[#bac3d2]">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          <span>选择智能体派发</span>
        </span>
        <span className="text-[10px] text-[#6b7585] font-mono">↑↓ 选择 · Enter 确定</span>
      </div>

      {/* Agent 列表 */}
      <div className="max-h-60 overflow-y-auto p-1.5 space-y-1">
        {filteredAgents.map((agent, index) => {
          const isSelected = index === selectedIndex;
          const isBusy = agent.isOnline && !!agent.activeTask;

          return (
            <div
              key={agent.id}
              data-index={index}
              onClick={() => onSelect(agent)}
              className={`px-2.5 py-2 rounded-lg cursor-pointer flex items-center justify-between transition-all ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "hover:bg-[#232731] text-[#dce1ea]"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* 头像 */}
                <div className="relative flex-shrink-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-[#252932] text-[#bac3d2] border border-[#2f3542]"
                    }`}
                  >
                    {agent.id.slice(0, 2).toUpperCase()}
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ${
                      isSelected ? "ring-indigo-600" : "ring-[#1a1d24]"
                    } ${
                      isBusy
                        ? "bg-amber-400"
                        : agent.isOnline
                        ? "bg-emerald-400"
                        : "bg-neutral-500"
                    }`}
                  />
                </div>

                {/* 文本信息 */}
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate">{agent.name}</span>
                    <span
                      className={`text-[11px] font-mono ${
                        isSelected ? "text-indigo-200" : "text-[#7f8898]"
                      }`}
                    >
                      @{agent.id}
                    </span>
                  </div>
                  {isBusy && agent.activeTask ? (
                    <div
                      className={`text-[10px] truncate ${
                        isSelected ? "text-amber-200" : "text-amber-400/90"
                      }`}
                    >
                      正在执行: {agent.activeTask.prompt}
                    </div>
                  ) : (
                    <div
                      className={`text-[10px] truncate ${
                        isSelected ? "text-indigo-200" : "text-[#6b7585]"
                      }`}
                    >
                      {agent.isOnline ? "空闲就绪" : "离线"}
                    </div>
                  )}
                </div>
              </div>

              {/* 状态徽章 */}
              <div className="flex-shrink-0 ml-2">
                {isBusy ? (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
                      isSelected
                        ? "bg-amber-500/30 text-amber-100"
                        : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    <Activity className="w-2.5 h-2.5 animate-pulse" />
                    执行中
                  </span>
                ) : agent.isOnline ? (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
                      isSelected
                        ? "bg-white/20 text-emerald-200"
                        : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    }`}
                  >
                    <Wifi className="w-2.5 h-2.5" />
                    在线
                  </span>
                ) : (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
                      isSelected ? "bg-white/10 text-neutral-300" : "text-neutral-500"
                    }`}
                  >
                    <WifiOff className="w-2.5 h-2.5" />
                    离线
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
