import express from "express";
import cors from "cors";
import OpenAI from "openai";
import checkoutRouter from "./routes/checkout.mjs";
import { createServerAdminClient } from "./lib/supabase.mjs";

// ── Express App（可用于本地 server/index.mjs，也可用于 Vercel Serverless）──
const app = express();

// ── 是否启用支付验证（仅在 Supabase + Zpay 完整配置时生效）──
const PAYMENT_REQUIRED =
  !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.ZPAY_PID);

// ── 中间件 ──────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "20mb" })); // 支持大 base64 图片

// ── 挂载支付路由 ─────────────────────────────────────────
app.use("/api/checkout", checkoutRouter);

// ── OpenAI / Qwen-VL 懒加载（避免启动时因缺少 Key 而崩溃）──
function getOpenAIClient() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error("服务端未配置 DASHSCOPE_API_KEY 环境变量");
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  });
}

// ── 系统提示词 ──────────────────────────────────────────
const SYSTEM_PROMPT = `你是一位专业的颜值分析与历史名人匹配 AI。
请分析用户上传的人脸照片，根据五官特征、面部比例、气质风格，给出颜值评分，并匹配最相似的中国历史名人。
你必须严格按照以下 JSON 格式返回，不得包含任何其他文字或 markdown 代码块：
{
  "score": <颜值评分，整数，范围 1-100>,
  "celebrity": "<最相似的中国历史名人姓名>",
  "similarity": <面部相似度百分比，整数，范围 1-100>,
  "description": "<该历史名人的简短介绍，20-50 字>",
  "dynasty": "<该名人所在的朝代或时代，如：唐代、西汉、三国等>"
}`;

// ── POST /api/analyze ───────────────────────────────────
// Body: { image: string (base64 data URL), out_trade_no?: string }
app.post("/api/analyze", async (req, res) => {
  try {
    const { image, out_trade_no } = req.body;

    if (!image) {
      return res.status(400).json({ success: false, error: "缺少 image 字段" });
    }

    // ── 支付验证（已配置 Supabase + Zpay 时强制校验）──────
    if (PAYMENT_REQUIRED) {
      if (!out_trade_no) {
        return res.status(402).json({ success: false, error: "请先完成支付后再进行分析" });
      }

      const supabase = createServerAdminClient();

      // 查询订单
      const { data: order, error: queryError } = await supabase
        .from("zpay_transactions")
        .select("status, amount, uid")
        .eq("out_trade_no", out_trade_no)
        .single();

      if (queryError || !order) {
        return res.status(404).json({ success: false, error: "订单不存在，请重新支付" });
      }

      if (order.status === "analyzed") {
        return res.status(409).json({ success: false, error: "该订单已使用，每次支付仅可分析一次" });
      }

      if (order.status !== "paid") {
        return res.status(402).json({ success: false, error: "订单尚未完成支付，请先支付 ¥0.50" });
      }

      // 原子更新：将状态从 paid → analyzed，防止并发重复调用
      const { error: updateError } = await supabase
        .from("zpay_transactions")
        .update({ status: "analyzed", updated_at: new Date().toISOString() })
        .eq("out_trade_no", out_trade_no)
        .eq("status", "paid"); // 用状态做乐观锁

      if (updateError) {
        console.error("[analyze] 更新订单状态失败", updateError);
        return res.status(500).json({ success: false, error: "服务器错误，请稍后重试" });
      }
    }

    // ── 支持 data URL 或纯 base64 ──────────────────────────
    const imageUrl = image.startsWith("data:")
      ? image
      : `data:image/jpeg;base64,${image}`;

    const openai = getOpenAIClient();

    // ── 60 秒超时保护 ──────────────────────────────────────
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    let response;
    try {
      response = await openai.chat.completions.create(
        {
          model: "qwen-vl-max",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "请分析这张照片，返回颜值评分和最相似的中国历史名人。只输出纯 JSON，不要包含任何 markdown 代码块或额外文字。",
                },
                { type: "image_url", image_url: { url: imageUrl } },
              ],
            },
          ],
          // 注意：response_format json_object 在 Qwen VL 系列不稳定，改由 prompt 强制 JSON 输出
        },
        { signal: controller.signal }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const raw = response.choices[0]?.message?.content ?? "";

    // ── 解析 JSON，含正则兜底 ──────────────────────────────
    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        result = JSON.parse(match[0]);
      } else {
        throw new Error("AI 返回内容无法解析为 JSON：" + raw);
      }
    }

    // ── 字段校验与兜底 ─────────────────────────────────────
    const safeResult = {
      score: Number(result.score) || 80,
      celebrity: String(result.celebrity || "历史名人"),
      similarity: Number(result.similarity) || 70,
      description: String(result.description || ""),
      dynasty: String(result.dynasty || ""),
    };

    return res.json({ success: true, data: safeResult });
  } catch (err) {
    console.error("[analyze error]", err?.message || err);
    const isTimeout = err?.name === "AbortError" || err?.message?.includes("abort");
    return res.status(isTimeout ? 504 : 500).json({
      success: false,
      error: isTimeout ? "AI 分析超时，请稍后重试" : (err?.message || "服务器内部错误"),
    });
  }
});

// ── 健康检查 ────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    payment_required: PAYMENT_REQUIRED,
  });
});

export default app;

