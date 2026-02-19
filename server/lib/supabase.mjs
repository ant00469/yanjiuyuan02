import { createClient } from "@supabase/supabase-js";

/**
 * 创建 Supabase 服务端管理员客户端（使用 SERVICE_ROLE_KEY，绕过 RLS）
 * 仅在服务端调用，切勿暴露给前端
 */
export function createServerAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "缺少 Supabase 配置：请检查 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 环境变量"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
