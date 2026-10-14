"use client";

import React, { useState } from "react";
import {
  X,
  Settings,
  Server,
  Network,
  Copy,
  Check,
  Info,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 顶部标题栏 */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-100 text-sm sm:text-base">
                服务连接与部署配置
              </h3>
              <p className="text-xs text-neutral-400">
                统一管理部署地址、WebSocket 网关与外部 Muse 智能体接入参数
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* 实时连接地址卡片 */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              <span>当前服务网关接入地址 (自动适配)</span>
            </div>

            <div className="space-y-2.5 bg-neutral-950/80 p-4 rounded-xl border border-neutral-800">
              {/* WS 地址 */}
              <div>
                <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
                  <span>智能体 WebSocket 网关 (WSS / WS):</span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> 协议自适应
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300">
                  <span className="truncate flex-1">{wsUrl}</span>
                  <button
                    onClick={() => handleCopy(wsUrl, "ws")}
                    className="text-neutral-400 hover:text-indigo-400 transition-colors"
                  >
                    {copiedKey === "ws" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* HTTP API 基地址 */}
              <div>
                <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
                  <span>API 服务基地址 (HTTP / HTTPS):</span>
                </div>
                <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-neutral-200">
                  <span className="truncate flex-1">{apiBaseUrl}</span>
                  <button
                    onClick={() => handleCopy(apiBaseUrl, "api")}
                    className="text-neutral-400 hover:text-indigo-400 transition-colors"
                  >
                    {copiedKey === "api" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 统一环境变量说明 */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5 text-indigo-400" />
              <span>部署改地址方案 (无需修改代码，单点统一配置)</span>
            </div>

            <div className="bg-neutral-950/80 p-4 rounded-xl border border-neutral-800 space-y-3 text-xs text-neutral-300 leading-relaxed">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                <p>
                  项目已经重构为<strong>动态自适应 + 统一环境变量中心</strong>
                  。前端所有 API 请求与 WebSocket 连接均由{" "}
                  <code className="text-indigo-300 bg-neutral-900 px-1 py-0.5 rounded">
                    src/lib/config.ts
                  </code>{" "}
                  集中管理，部署到不同服务器时<strong>无需在任何代码中搜索替换 URL</strong>！
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="text-neutral-400 text-[11px] font-medium">
                  生产环境通过 .env 统一覆盖地址（支持独立域名、IP 与端口）：
                </div>
                <div className="relative">
                  <pre className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-[11px] font-mono text-neutral-200 overflow-x-auto">
{`# 统一修改后端 API 基础前缀 (留空则默认同源)
NEXT_PUBLIC_API_BASE_URL="http://101.43.53.182:3000"

# 统一修改 Agent 接入 WebSocket 地址
NEXT_PUBLIC_WS_URL="ws://101.43.53.182:3000/ws/agent"`}
                  </pre>
                  <button
                    onClick={() =>
                      handleCopy(
                        `NEXT_PUBLIC_API_BASE_URL="http://101.43.53.182:3000"\nNEXT_PUBLIC_WS_URL="ws://101.43.53.182:3000/ws/agent"`,
                        "env"
                      )
                    }
                    className="absolute right-2 top-2 p-1.5 rounded bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                    title="复制环境变量模板"
                  >
                    {copiedKey === "env" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-neutral-400 space-y-1">
                <div>💡 提示：</div>
                <div>1. 若使用 <strong>Caddy / Nginx</strong> 统一做反向代理，只需将环境变量留空，页面会自动检测访问域名与 <code>wss://</code> 协议。</div>
                <div>2. 如果使用 Docker Compose，直接在 <code>docker-compose.yml</code> 所在目录配置 <code>.env</code> 即可一键生效。</div>
              </div>
            </div>
          </div>
        </div>

        {/* 底部按钮栏 */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950/50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-neutral-800 hover:bg-neutral-700 text-white text-xs px-5 py-2.5 rounded-xl font-medium transition-colors"
          >
            知道了，关闭
          </button>
        </div>
      </div>
    </div>
  );
}
