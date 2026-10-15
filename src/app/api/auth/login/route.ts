import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, signSessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const username = (body.username || "").trim();
    const password = (body.password || "").trim();

    if (!username || !password) {
      return NextResponse.json({ error: "请输入用户名和密码" }, { status: 400 });
    }

    // 从数据库检索用户
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
    }

    // 校验 Bcrypt 密码哈希
    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
    }

    // 签发安全 JWT
    const token = signSessionToken({
      userId: user.id,
      username: user.username,
      name: user.name || user.username,
      role: user.role,
      avatar: user.avatar,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
      },
    });

    // 写入 HttpOnly 安全 Cookie (30 天有效)
    response.cookies.set({
      name: "hub_token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 天
      path: "/",
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "登录处理异常";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
