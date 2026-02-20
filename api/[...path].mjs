import app from "../server/app.mjs";

// Vercel Serverless Function entry:
// - 该文件会接住所有 /api/* 请求
// - Express app 本身就是 (req, res) => void 的 handler，可直接导出
export default app;

