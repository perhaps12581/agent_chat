"use client";

import React, { useState } from "react";
import { Lock, User, ArrowRight, Layers, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    const formData = new FormData(e.currentTarget);
    const inputUsername = ((formData.get("username") as string) || username || "").trim();
    const inputPassword = ((formData.get("password") as string) || password || "").trim();

    if (!inputUsername) {
      setError("请输入用户名");
      return;
    }
    if (!inputPassword) {
      setError("请输入密码");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: inputUsername, password: inputPassword }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        window.location.href = "/";
      } else {
        setError(data.error || "账号或密码错误");
        setLoading(false);
      }
    } catch {
      setError("网络连接异常，请稍后重试");
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
            Agent Hub 调度中心
          </h1>
          <p className="text-[11px] text-[#717b8b] flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> 用户身份鉴权已启用
          </p>
        </div>

        {/* 登录卡片 */}
        <div className="p-5 rounded-2xl bg-[#181a20]/90 border border-[#262a34] backdrop-blur-md shadow-xl">
          <form onSubmit={handleLogin} className="space-y-3.5">
            {/* 用户名 */}
            <div>
              <label className="block text-[11px] font-medium text-[#7e8797] mb-1">
                用户名
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#666f7f]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  name="username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="admin"
                  required
                  autoComplete="username"
                  className="w-full pl-9 pr-4 py-2 bg-[#121417] border border-[#272b36] rounded-xl text-sm text-[#e2e6eb] placeholder-[#576070] focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {/* 密码 */}
            <div>
              <label className="block text-[11px] font-medium text-[#7e8797] mb-1">
                登录密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#666f7f]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="请输入密码..."
                  autoFocus
                  required
                  autoComplete="current-password"
                  className="w-full pl-9 pr-4 py-2 bg-[#121417] border border-[#272b36] rounded-xl text-sm text-[#e2e6eb] placeholder-[#576070] focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-900/50 p-2 rounded-lg text-center animate-in fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98] cursor-pointer"
            >
              <span>{loading ? "验证中..." : "登 录"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
