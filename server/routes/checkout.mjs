import { Router } from "express";
import { createServerAdminClient } from "../lib/supabase.mjs";
import { generateSign, verifySign, generateOrderNo } from "../lib/zpay.mjs";

const router = Router();

// ── 常量 ─────────────────────────────────────────────────
const ZPAY_SUBMIT_URL = "https://zpayz.cn/submit.php";
const ORDER_AMOUNT = "0.50";       // 固定价格：人民币 0.5 元
const PRODUCT_NAME = "颜究院颜值分析";

// ── 工具：读取并校验支付环境变量 ─────────────────────────
function getZpayConfig() {
  const pid = process.env.ZPAY_PID;
  const key = process.env.ZPAY_KEY;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!pid || !key || !baseUrl) {
    throw new Error("支付配置缺失：请检查 ZPAY_PID、ZPAY_KEY、NEXT_PUBLIC_BASE_URL 环境变量");
  }
  return { pid, key, baseUrl };
}

// ────────────────────────────────────────────────────────
// POST /api/checkout/providers/zpay/url
// 前端请求获取支付跳转链接
// Body: { uid: string, pay_type?: "alipay" | "wxpay" }
// ────────────────────────────────────────────────────────
router.post("/providers/zpay/url", async (req, res) => {
  try {
    const { uid, pay_type = "alipay" } = req.body;

    if (!uid) {
      return res.status(400).json({ success: false, error: "缺少用户标识 uid" });
    }
    if (!["alipay", "wxpay"].includes(pay_type)) {
      return res.status(400).json({ success: false, error: "pay_type 仅支持 alipay 或 wxpay" });
    }

    const { pid, key, baseUrl } = getZpayConfig();

    // 1. 生成唯一订单号
    const out_trade_no = generateOrderNo();

    // 2. 写入数据库，状态 pending
    const supabase = createServerAdminClient();
    const { error: dbError } = await supabase.from("zpay_transactions").insert({
      out_trade_no,
      uid,
      amount: parseFloat(ORDER_AMOUNT),
      pay_type,
      status: "pending",
    });

    if (dbError) {
      console.error("[zpay/url] DB insert error:", dbError);
      return res.status(500).json({ success: false, error: "创建订单失败，请稍后重试" });
    }

    // 3. 构建签名参数（不含 sign / sign_type）
    const params = {
      pid,
      name: PRODUCT_NAME,
      money: ORDER_AMOUNT,
      out_trade_no,
      notify_url: `${baseUrl}/api/checkout/providers/zpay/webhook`,
      return_url: `${baseUrl}`,   // zpay 不支持带参数，支付完成后跳回首页
      type: pay_type,
    };

    // 4. 生成签名，拼接完整支付 URL
    const sign = generateSign(params, key);
    const qs = new URLSearchParams({ ...params, sign, sign_type: "MD5" }).toString();
    const payUrl = `${ZPAY_SUBMIT_URL}?${qs}`;

    console.log(`[zpay/url] 创建订单 ${out_trade_no} uid=${uid} amount=${ORDER_AMOUNT}`);

    return res.json({ success: true, url: payUrl, out_trade_no });
  } catch (err) {
    console.error("[zpay/url] error:", err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || "服务器错误" });
  }
});

// ────────────────────────────────────────────────────────
// GET /api/checkout/providers/zpay/webhook
// 易支付服务器异步回调（notify_url）
// 必须返回纯字符串 "success"，否则平台会重试
// ────────────────────────────────────────────────────────
router.get("/providers/zpay/webhook", async (req, res) => {
  try {
    const params = req.query; // 所有回调参数
    const { money, out_trade_no, trade_no, trade_status, type } = params;

    const key = process.env.ZPAY_KEY;
    if (!key) {
      console.error("[zpay/webhook] ZPAY_KEY 未配置");
      return res.status(500).send("error");
    }

    // ── 安全校验 1：验证签名防止伪造通知 ──────────────────
    if (!verifySign(params, key)) {
      console.warn("[zpay/webhook] ❌ 签名验证失败", { out_trade_no });
      return res.status(400).send("sign error");
    }

    // ── 只处理支付成功状态 ──────────────────────────────
    if (trade_status !== "TRADE_SUCCESS") {
      console.log("[zpay/webhook] 非成功状态，跳过", { out_trade_no, trade_status });
      return res.send("success"); // 必须返回 success，否则平台重试
    }

    const supabase = createServerAdminClient();

    // ── 幂等校验：查询订单是否存在 ──────────────────────
    const { data: order, error: queryError } = await supabase
      .from("zpay_transactions")
      .select("*")
      .eq("out_trade_no", out_trade_no)
      .single();

    if (queryError || !order) {
      console.warn("[zpay/webhook] 订单不存在", { out_trade_no });
      return res.status(404).send("order not found");
    }

    // ── 幂等校验：已处理则直接返回 success ───────────────
    if (order.status !== "pending") {
      console.log("[zpay/webhook] 订单已处理，跳过重复通知", { out_trade_no, status: order.status });
      return res.send("success");
    }

    // ── 安全校验 2：金额一致性校验 ─────────────────────
    if (parseFloat(money) !== parseFloat(order.amount)) {
      console.error("[zpay/webhook] ❌ 金额不匹配！疑似假通知", {
        received: money,
        expected: order.amount,
        out_trade_no,
      });
      return res.status(400).send("amount mismatch");
    }

    // ── 更新订单状态为已支付（条件更新防并发重入）─────────
    const { error: updateError } = await supabase
      .from("zpay_transactions")
      .update({
        status: "paid",
        trade_no,
        trade_status,
        pay_type: type,
        updated_at: new Date().toISOString(),
      })
      .eq("out_trade_no", out_trade_no)
      .eq("status", "pending"); // 用状态做并发锁

    if (updateError) {
      console.error("[zpay/webhook] 更新订单失败", updateError);
      return res.status(500).send("error");
    }

    console.log(`[zpay/webhook] ✅ 支付成功 out_trade_no=${out_trade_no} trade_no=${trade_no} uid=${order.uid}`);

    // 必须返回纯字符串 "success"
    return res.send("success");
  } catch (err) {
    console.error("[zpay/webhook] error:", err?.message || err);
    return res.status(500).send("error");
  }
});

// ────────────────────────────────────────────────────────
// GET /api/checkout/providers/zpay/status
// 前端轮询订单支付状态
// Query: { out_trade_no: string }
// ────────────────────────────────────────────────────────
router.get("/providers/zpay/status", async (req, res) => {
  try {
    const { out_trade_no } = req.query;

    if (!out_trade_no) {
      return res.status(400).json({ success: false, error: "缺少 out_trade_no 参数" });
    }

    const supabase = createServerAdminClient();
    const { data: order, error } = await supabase
      .from("zpay_transactions")
      .select("status, uid, amount, created_at")
      .eq("out_trade_no", out_trade_no)
      .single();

    if (error || !order) {
      return res.status(404).json({ success: false, error: "订单不存在" });
    }

    return res.json({
      success: true,
      status: order.status,   // pending | paid | analyzed
      uid: order.uid,
    });
  } catch (err) {
    console.error("[zpay/status] error:", err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || "服务器错误" });
  }
});

export default router;
