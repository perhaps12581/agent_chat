import { WebSocket } from "ws";

const WS_URL = "ws://localhost:3000/ws/agent";
const TOKEN = "agtk_live_muse_secret_token_20261013";
const AGENT_ID = "muse";

console.log(`[Mock Muse] 启动测试客户端，连接目标: ${WS_URL}`);

const ws = new WebSocket(WS_URL, {
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "X-Agent-Id": AGENT_ID,
  },
});

let heartbeatTimer: NodeJS.Timeout;

ws.on("open", () => {
  console.log(`[Mock Muse] WebSocket 连接已打开，50ms 后发送 AGENT_READY`);

  setTimeout(() => {
    const payload = JSON.stringify({
      type: "AGENT_READY",
      agentId: AGENT_ID,
      protocolVersion: "1.0",
      capabilities: ["step_progress", "artifacts_meta"],
      pendingTaskIds: [],
    });

    ws.send(payload, (err) => {
      if (err) {
        console.error(`[Mock Muse] 发送 AGENT_READY 失败:`, err);
      } else {
        console.log(`[Mock Muse] 已成功发出 AGENT_READY 报文`);
      }
    });
  }, 50);
});

ws.on("message", async (data: Buffer) => {
  const msg = JSON.parse(data.toString());
  console.log(`[Mock Muse] 收到下行报文:`, msg.type, msg);

  // 1. 协商报文
  if (msg.type === "PLATFORM_HELLO") {
    console.log(`[Mock Muse] 收到 PLATFORM_HELLO 协商参数，启动 30s 心跳`);
    heartbeatTimer = setInterval(() => {
      ws.send(JSON.stringify({ type: "PING", ts: Date.now() }));
    }, 30000);
  }

  // 2. 心跳响应
  if (msg.type === "PONG") {
    console.log(`[Mock Muse] 收到服务端 PONG 心跳回显`);
  }

  // 3. 收到任务派发
  if (msg.type === "TASK_DISPATCH") {
    const { taskId, prompt } = msg;
    console.log(`[Mock Muse] 收到新任务: ${taskId}, Prompt: "${prompt}"`);

    // 立即回复 TASK_ACK (已落盘)
    ws.send(
      JSON.stringify({
        type: "TASK_ACK",
        taskId,
        status: "ACCEPTED",
        ts: Date.now(),
      })
    );

    // 模拟执行过程中的步骤级上报
    const steps = [
      { step: "ACCEPTED", progress: 20, message: "任务已接收，正在排队分析..." },
      { step: "FETCH_CONTEXT", progress: 45, message: "正在拉取上下文和相关历史代码..." },
      { step: "TOOL_EXECUTION", progress: 75, message: "正在执行推理与代码审查工具..." },
      { step: "ARTIFACT_READY", progress: 90, message: "产物与修复补丁已生成就绪..." },
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const s = steps[i];
      ws.send(
        JSON.stringify({
          msgId: `msg_${Date.now()}_${i}`,
          type: "TASK_PROGRESS",
          taskId,
          seq: i + 1,
          step: s.step,
          message: s.message,
          progress: s.progress,
          ts: Date.now(),
        })
      );
    }

    // 最终完成上报 TASK_COMPLETE
    await new Promise((resolve) => setTimeout(resolve, 1500));
    ws.send(
      JSON.stringify({
        msgId: `msg_${Date.now()}_final`,
        type: "TASK_COMPLETE",
        taskId,
        seq: steps.length + 1,
        status: "SUCCEEDED",
        result: `【Muse 已完成任务】\n针对 "${prompt}" 的分析：已验证接口健壮性，并完成了相关优化方案。`,
        artifacts: [
          {
            name: "patch-report.json",
            mime: "application/json",
            size: 2048,
            sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            transfer: "meta_only",
          },
        ],
        ts: Date.now(),
      })
    );
  }

  // 4. 收到平台的回执
  if (msg.type === "PLATFORM_RECEIPT") {
    console.log(`[Mock Muse] 收到平台的上行确认回执: ackMsgId=${msg.ackMsgId}, taskId=${msg.taskId}`);
  }
});

ws.on("close", (code, reason) => {
  console.log(`[Mock Muse] 连接关闭: code=${code}, reason=${reason.toString()}`);
  clearInterval(heartbeatTimer);
});

ws.on("error", (err) => {
  console.error(`[Mock Muse] 套接字异常:`, err.message);
});
