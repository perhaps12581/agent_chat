"use client";

import React, { useState } from "react";
import {
  X,
  Settings,
  Server,
  Network,
  Copy,
  Check,
  CheckCircle2,
} from "lucide-react";
import { appConfig } from "@/lib/config";

interface AgentConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AgentConfigModal({
  isOpen,
  onClose,
}: AgentConfigModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const wsUrl = appConfig.getWsUrl();
  const apiBaseUrl = appConfig.apiBaseUrl || `${currentOrigin} (自适应当前域)`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#181a21] border border-[#272b36] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 顶部标题栏 */}
        <div className="px-5 py-3.5 border-b border-[#242833] flex items-center justify-between bg-[#13151a]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Settings className="w-4 h-4" />
            </div>
            <h3 className="font-medium text-[#e2e6eb] text-sm">
              服务接入配置
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#747e8f] hover:text-[#d3d9e4] hover:bg-[#20242e] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="space-y-2.5">
            <div className="text-[11px] font-medium text-[#8892a2] uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              <span>当前接入地址</span>
            </div>

            <div className="space-y-2 bg-[#121418] p-3.5 rounded-xl border border-[#222630]">
              {/* WS 地址 */}
              <div>
                <div className="flex items-center justify-between text-xs text-[#7d8797] mb-1">
                  <span>WebSocket 网关 (WSS / WS):</span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> 协议自适应
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-[#191c23] border border-[#262b35] rounded-lg px-2.5 py-1.5 text-xs font-mono text-emerald-300">
                  <span className="truncate flex-1">{wsUrl}</span>
                  <button
                    onClick={() => handleCopy(wsUrl, "ws")}
                    className="text-[#7d8797] hover:text-indigo-400 transition-colors"
                  >
                    {copiedKey === "ws" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* HTTP API 基地址 */}
              <div>
                <div className="flex items-center justify-between text-xs text-[#7d8797] mb-1">
                  <span>API 服务地址:</span>
                </div>
                <div className="flex items-center gap-2 bg-[#191c23] border border-[#262b35] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#d1d7e2]">
                  <span className="truncate flex-1">{apiBaseUrl}</span>
                  <button
                    onClick={() => handleCopy(apiBaseUrl, "api")}
                    className="text-[#7d8797] hover:text-indigo-400 transition-colors"
                  >
                    {copiedKey === "api" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-medium text-[#8892a2] uppercase tracking-wider flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5 text-indigo-400" />
              <span>环境变量调整说明</span>
            </div>

            <div className="bg-[#121418] p-3.5 rounded-xl border border-[#222630] space-y-2 text-xs text-[#959fad] leading-relaxed">
              <p>
                若将前端单独部署到独立域名或端口，只需在前端根目录 <code className="text-amber-300 font-mono bg-[#1a1d24] px-1 py-0.5 rounded">.env</code> 中设置：
              </p>
              <pre className="bg-[#181a22] p-2 rounded-lg font-mono text-[11px] text-indigo-200 border border-[#272c38]">
NEXT_PUBLIC_API_BASE_URL=https://your-domain.com
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
