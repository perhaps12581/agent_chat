import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. 白名单路径：登录页面、登录 API、静态资源、Next 内部资源
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/api/v1/agent") // Agent 节点专用的超限拉取接口，自带独立 Token 鉴权
  ) {
    return NextResponse.next();
  }

  // 2. 检查会话 Cookie
  const session = request.cookies.get("hub_session");
  const isAuthenticated = session?.value === "authenticated";

  // 3. 未鉴权处理
  if (!isAuthenticated) {
    // 如果是 API 请求，返回 401 JSON
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized: Access password required" }, { status: 401 });
    }

    // 如果是页面请求，重定向至登录页
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，排除常见静态图片等
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
