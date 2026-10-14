/**
 * 统一配置管理中心 (Unified Application Configuration)
 * 无论是修改部署域名、IP、端口，还是配置 API / WebSocket 网关，均在此统一管理与推导
 */

export const appConfig = {
  /**
   * API 基础请求路径 (默认为空字符串，即使用浏览器当前域名的相对路径)
   * 如有独立 API 服务或不同端口，可通过环境变量 NEXT_PUBLIC_API_BASE_URL 统一重定向
   */
  get apiBaseUrl(): string {
    const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (envUrl) {
      return envUrl.replace(/\/+$/, "");
    }
    return "";
  },

  /**
   * 获取 Agent WebSocket 网关连接地址
   * 1. 优先读取 NEXT_PUBLIC_WS_URL 环境变量 (例如 wss://hub.example.com/ws/agent)
   * 2. 在浏览器环境中自动根据 window.location 自动生成匹配当前协议和端口的地址
   * 3. 在服务端环境回退到 ws://localhost:3000/ws/agent
   */
  getWsUrl(): string {
    const envWsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (envWsUrl) {
      return envWsUrl;
    }

    if (typeof window !== "undefined") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.host}/ws/agent`;
    }

    const port = process.env.PORT || "3000";
    return `ws://localhost:${port}/ws/agent`;
  },

  /**
   * 格式化 API 请求路径
   */
  apiUrl(path: string): string {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${this.apiBaseUrl}${cleanPath}`;
  },
};

/**
 * 统一 API 请求封装
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<{ data?: T; error?: string; status: number }> {
  const url = appConfig.apiUrl(path);
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const status = res.status;

    if (status === 401) {
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login";
      }
      return { error: "登录凭证已失效，请重新登录", status };
    }

    let data: unknown = null;
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    if (!res.ok) {
      const dataObj = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
      const errorMsg =
        (typeof dataObj?.error === "string" ? dataObj.error : null) ||
        (typeof dataObj?.message === "string" ? dataObj.message : null) ||
        `请求失败: ${res.statusText}`;
      return { error: errorMsg, status, data: data as T };
    }

    return { data: data as T, status };
  } catch (err: unknown) {
    console.error(`[apiFetch error] ${url}:`, err);
    const message = err instanceof Error ? err.message : "网络请求异常";
    return { error: message, status: 0 };
  }
}
