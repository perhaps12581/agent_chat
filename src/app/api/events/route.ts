import { AgentGateway } from "@/lib/agent-gateway";

export async function GET() {
  const gateway = AgentGateway.getInstance();

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (data: unknown) => {
        try {
          const payload = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(new TextEncoder().encode(payload));
        } catch {
          // 忽略发送异常
        }
      };

      // 注册网关事件监听
      const unsubscribe = gateway.onEvent((event: Record<string, unknown>) => {
        sendEvent(event);
      });

      // 发送就绪心跳
      sendEvent({ type: "INIT", message: "SSE connected" });

      const keepAlive = setInterval(() => {
        sendEvent({ type: "PING" });
      }, 15000);

      // 连接中断清理
      return () => {
        unsubscribe();
        clearInterval(keepAlive);
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
