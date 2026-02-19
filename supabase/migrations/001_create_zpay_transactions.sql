-- ============================================================
-- 表：zpay_transactions
-- 用途：存储易支付（zpay）交易记录
-- 创建时间：2026-02-19
-- ============================================================

CREATE TABLE IF NOT EXISTS zpay_transactions (
  id              UUID          DEFAULT gen_random_uuid()  PRIMARY KEY,

  -- 订单标识
  out_trade_no    VARCHAR(64)   NOT NULL UNIQUE,   -- 商户订单号（我方生成，格式：YYYYMMDDHHmmss + 3位随机数）
  trade_no        VARCHAR(128),                    -- 易支付平台订单号（回调后填充）

  -- 用户信息
  uid             VARCHAR(255)  NOT NULL,          -- 用户标识（前端 localStorage 生成的 UUID）

  -- 订单金额
  amount          DECIMAL(10, 2) NOT NULL DEFAULT 0.50,  -- 订单金额（人民币），固定 0.50 元

  -- 支付信息
  pay_type        VARCHAR(20)   DEFAULT 'alipay',  -- 支付方式：alipay（支付宝）/ wxpay（微信支付）
  trade_status    VARCHAR(50),                     -- 易支付返回的交易状态（如 TRADE_SUCCESS）
  param           TEXT,                            -- 附加参数（原样返回）

  -- 订单状态流转
  -- pending   → 已创建，等待用户支付
  -- paid      → 用户已支付，等待分析
  -- analyzed  → AI 分析已完成（每次支付仅允许分析一次）
  status          VARCHAR(20)   NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'paid', 'analyzed')),

  -- 时间戳
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── 索引 ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_zpay_uid        ON zpay_transactions(uid);
CREATE INDEX IF NOT EXISTS idx_zpay_status     ON zpay_transactions(status);
CREATE INDEX IF NOT EXISTS idx_zpay_created_at ON zpay_transactions(created_at DESC);

-- ── 自动更新 updated_at 触发器 ────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS zpay_transactions_updated_at ON zpay_transactions;
CREATE TRIGGER zpay_transactions_updated_at
  BEFORE UPDATE ON zpay_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── 行级安全策略（RLS）────────────────────────────────────
-- 启用 RLS：普通匿名用户无法直接读写此表
ALTER TABLE zpay_transactions ENABLE ROW LEVEL SECURITY;

-- 仅 Service Role（后端 createServerAdminClient）可绕过 RLS 完全访问
-- 前端使用 anon key 无权访问，保障支付数据安全
