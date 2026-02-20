import app from "./app.mjs";
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ 颜究院后端服务已启动：http://localhost:${PORT}`);
  console.log("   说明：Vercel 部署请走 api/[...path].mjs（Serverless），本文件仅用于本地/自建服务器启动");
});
