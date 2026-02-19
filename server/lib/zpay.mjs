import crypto from "crypto";

/**
 * 构建签名字符串：
 * 过滤空值、sign、sign_type，按参数名 ASCII 升序排列，拼接为 key=value&key=value
 */
export function buildSignString(params) {
  return Object.entries(params)
    .filter(
      ([k, v]) =>
        v !== "" && v !== null && v !== undefined && k !== "sign" && k !== "sign_type"
    )
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}

/**
 * 生成 MD5 签名
 * sign = md5( 排序拼接字符串 + KEY )，结果小写
 */
export function generateSign(params, key) {
  const signStr = buildSignString(params);
  return crypto.createHash("md5").update(signStr + key).digest("hex");
}

/**
 * 验证回调签名是否合法
 */
export function verifySign(params, key) {
  if (!params.sign) return false;
  const expected = generateSign(params, key);
  return params.sign === expected;
}

/**
 * 生成订单号：YYYYMMDDHHmmss + 3位随机数
 * 例：20260219231505342
 */
export function generateOrderNo() {
  const d = new Date();
  const p = (n, l = 2) => String(n).padStart(l, "0");
  const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const rand = Math.floor(Math.random() * 900) + 100;
  return `${ts}${rand}`;
}
