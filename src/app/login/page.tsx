"use client";

import React, { useState } from "react";
import { Lock, ArrowRight, Layers } from "lucide-react";
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
        setError(data.error || "访问密码错误");
      }
    } catch {
      setError("网络连接异常");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#131518] flex flex-col justify-center items-center p-4 text-[#e3e7ee] font-sans selection:bg-indigo-500/30 selection:text-white">
      {/* 柔和微光 */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 space-y-5">
        {/* 顶部 Logo */}
        <div className="text-center space-y-1.5">
          <div className="w-11 h-11 rounded-xl bg-[#1b1e25] border border-[#2b303d] flex items-center justify-center mx-auto shadow-sm">
            <Layers className="w-5 h-5 text-indigo-400" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-[#e2e6ec]">
            Agent Hub
          </h1>
        </div>

        {/* 登录卡片 */}
        <div className="p-5 rounded-2xl bg-[#181a20]/90 border border-[#262a34] backdrop-blur-md shadow-xl">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#666f7f]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入访问密码..."
                  autoFocus
                  required
                  className="w-full pl-9 pr-4 py-2.5 bg-[#121417] border border-[#272b36] rounded-xl text-sm text-[#e2e6eb] placeholder-[#576070] focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="text-xs text-rose-300 bg-rose-950/30 border border-rose-900/40 p-2 rounded-lg text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98]"
            >
              <span>{loading ? "验证中..." : "进入工作台"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
