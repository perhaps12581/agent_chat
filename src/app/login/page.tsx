"use client";

import React, { useState } from "react";
import { Lock, ArrowRight, ShieldCheck, Layers } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password || loading) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push("/");
        router.refresh();
      } else {
        setError(data.error || "访问密码错误，请重试");
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center p-4 text-neutral-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* 背景光斑 */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 space-y-6">
        {/* 顶部 Logo & 标题 */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto shadow-inner">
            <Layers className="w-6 h-6 text-indigo-400" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-100">
            Agent Hub 调度中心
          </h1>
          <p className="text-xs text-neutral-400 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> 私有智能体调度工作台已受保护
          </p>
        </div>

        {/* 登录卡片 */}
        <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-xl shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wider">
                访问凭证
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入访问密码..."
                  autoFocus
                  required
                  className="w-full pl-9 pr-4 py-2.5 bg-neutral-950/80 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/40 p-2.5 rounded-lg text-center animate-shake">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
            >
              <span>{loading ? "正在验证..." : "进入调度中心"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* 底部版权 */}
        <div className="text-center text-[11px] text-neutral-600">
          WS Agent Gateway Protocol v1.1
        </div>
      </div>
    </div>
  );
}
