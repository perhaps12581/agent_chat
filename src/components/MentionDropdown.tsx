"use client";

import React, { useEffect, useRef } from "react";
import { Wifi, WifiOff, Sparkles } from "lucide-react";

export interface AgentItem {
  id: string;
  name: string;
  token?: string;
  status: string;
  isOnline: boolean;
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
      className="absolute bottom-full left-0 mb-2 w-80 max-w-[92vw] bg-neutral-900/95 border border-neutral-700/80 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden z-40 animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      {/* 顶部标题提示 */}
      <div className="px-3.5 py-2 border-b border-neutral-800 bg-neutral-950/60 flex items-center justify-between text-[11px] text-neutral-400">
        <div className="flex items-center gap-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>选择 Muse Agent 派发任务</span>
        </div>
        <span className="text-[10px] text-neutral-500 font-mono">
          ↑↓ 切换 · 回车选中
        </span>
      </div>

      {/* Agent 列表 */}
      <div className="max-h-60 overflow-y-auto p-1.5 space-y-1">
        {filteredAgents.map((agent, index) => {
          const isSelected = index === selectedIndex;
          const caps = Array.isArray(agent.capabilities)
            ? agent.capabilities.join(", ")
            : "";

          return (
            <div
              key={agent.id}
              data-index={index}
              onClick={() => onSelect(agent)}
              onMouseEnter={() => {}}
              className={`px-3 py-2 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "hover:bg-neutral-800/80 text-neutral-200"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* 头像与在线绿点 */}
                <div className="relative flex-shrink-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-neutral-800 text-neutral-300 border border-neutral-700"
                    }`}
                  >
                    {agent.id.slice(0, 2).toUpperCase()}
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ${
                      isSelected ? "ring-indigo-600" : "ring-neutral-900"
                    } ${
                      agent.isOnline
                        ? "bg-emerald-400 shadow-sm shadow-emerald-400/50"
                        : "bg-neutral-500"
                    }`}
                  />
                </div>

                {/* 文本信息 */}
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate">
                      {agent.name}
                    </span>
                    <span
                      className={`text-[11px] font-mono ${
                        isSelected ? "text-indigo-200" : "text-neutral-400"
                      }`}
                    >
                      @{agent.id}
                    </span>
                  </div>
                  {caps && (
                    <div
                      className={`text-[10px] truncate ${
                        isSelected ? "text-indigo-100" : "text-neutral-400"
                      }`}
                    >
                      {caps}
                    </div>
                  )}
                </div>
              </div>

              {/* 右侧状态 Badge */}
              <div className="flex-shrink-0 ml-2">
                {agent.isOnline ? (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
                      isSelected
                        ? "bg-white/20 text-emerald-200"
                        : "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
                    }`}
                  >
                    <Wifi className="w-2.5 h-2.5" />
                    在线
                  </span>
                ) : (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
                      isSelected
                        ? "bg-white/10 text-neutral-300"
                        : "bg-neutral-800 text-neutral-400"
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
