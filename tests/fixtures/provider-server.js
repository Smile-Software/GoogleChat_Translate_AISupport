import http from "node:http";

export function startProviderServer() {
  const requests = [];
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
    if (req.url === "/v1/models") {
      res.end(JSON.stringify({ data: [{ id: "alpha" }, { id: "luna-fast" }, { id: "beta" }] }));
      return;
    }
    if (req.url === "/v1/chat/completions") {
      const parsed = JSON.parse(body || "{}");
      const user = parsed.messages?.find((item) => item.role === "user")?.content || "";
      const text = user.includes("Thread messages") || user.includes("Previous summary")
        ? "Tóm tắt: đã xác nhận vấn đề; cần kiểm tra và phản hồi tiếp."
        : user.includes("午後") ? "Chiều nay sẽ nhờ Toyota kiểm tra. Vui lòng chờ một chút."
        : user.includes("作業中") ? "Đang xử lý, có vấn đề. Hãy tham khảo Teams và xử lý."
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
      close: () => new Promise((done) => server.close(done))
    });
  }));
}
