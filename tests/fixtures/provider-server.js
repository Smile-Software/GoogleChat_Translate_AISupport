import http from "node:http";

export function startProviderServer() {
  const requests = [];
  const failures = [];
  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    const record = { method: req.method, url: req.url, body };
    requests.push(record);
    res.setHeader("Content-Type", "application/json");
    const scenario = failures.shift();
    if (scenario === "auth") {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: { message: "fixture auth detail" } }));
      return;
    }
    if (scenario === "rate-limit") {
      res.statusCode = 429;
      res.end(JSON.stringify({ error: { message: "fixture rate limit detail" } }));
      return;
    }
    if (scenario === "server") {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: { message: "fixture server detail" } }));
      return;
    }
    if (scenario === "timeout") {
      await new Promise((resolve) => setTimeout(resolve, 1250));
      res.end(JSON.stringify({ choices: [{ message: { content: "late fixture response" } }] }));
      return;
    }
    if (scenario === "malformed-json") {
      res.end("not-json");
      return;
    }
    if (scenario === "missing-content") {
      res.end(JSON.stringify({ choices: [{}] }));
      return;
    }
    if (req.url === "/v1/models") {
      res.end(JSON.stringify({ data: [{ id: "alpha" }, { id: "luna-fast" }, { id: "beta" }] }));
      return;
    }
    if (req.url === "/v1/chat/completions") {
      const parsed = JSON.parse(body || "{}");
      const user = parsed.messages?.find((item) => item.role === "user")?.content || "";
      const target = user.split(/(?:MESSAGE TO TRANSLATE|DRAFT MESSAGE TO TRANSLATE):\s*/).pop();
      const text = scenario === "xss" ? "<img src=x onerror=alert('fixture')>"
        : user.includes("Thread messages") || user.includes("Previous summary")
        ? "Tóm tắt: đã xác nhận vấn đề; cần kiểm tra và phản hồi tiếp."
        : target.includes("午後") ? "Chiều nay sẽ nhờ Toyota kiểm tra. Vui lòng chờ một chút."
        : target.includes("作業中") ? "Đang xử lý, có vấn đề. Hãy tham khảo Teams và xử lý."
        : "Bản dịch kiểm thử.";
      res.end(JSON.stringify({ choices: [{ message: { content: text } }] }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: { message: "Not found" } }));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    resolve({
      baseUrl: "http://127.0.0.1:" + address.port + "/v1",
      requests,
      close: () => new Promise((done) => server.close(done)),
      failNext: (scenario) => failures.push(scenario)
    });
  }));
}
