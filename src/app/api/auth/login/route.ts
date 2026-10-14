import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { password } = await req.json();
    const correctPassword = process.env.ACCESS_PASSWORD;

    if (!correctPassword) {
      return NextResponse.json({ error: "服务器未配置 ACCESS_PASSWORD 环境变量" }, { status: 500 });
    }

    if (!password || password !== correctPassword) {
      return NextResponse.json({ error: "访问密码错误" }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });

    // 写入安全 HttpOnly Cookie，有效期 30 天
    response.cookies.set({
      name: "hub_session",
      value: "authenticated",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 天
      path: "/",
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "未知登录异常";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
