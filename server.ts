import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";
import { AgentGateway } from "./src/lib/agent-gateway";
import { seedAgents } from "./src/lib/seed";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function start() {
  await app.prepare();

  // 1. 初始化数据库中预置的 muse 和 dot Agent
  try {
    await seedAgents();
  } catch (err: any) {
    console.error("Database seed warning:", err.message);
  }

  // 2. 创建 HTTP 基础服务器
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // 3. 创建 Agent WebSocket 网关 (/ws/agent)
  const wss = new WebSocketServer({ noServer: true });
  const gateway = AgentGateway.getInstance();
  gateway.setupWebSocketServer(wss);

  // 4. 处理协议升级 (HTTP -> WSS)
  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url || "");

    if (pathname === "/ws/agent") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  // 5. 启动监听
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> Agent WebSocket Gateway ready on ws://localhost:${port}/ws/agent`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
