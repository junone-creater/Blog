import { createClient } from "@supabase/supabase-js";

// 서버 전용 Supabase 클라이언트.
// service_role 키를 사용하므로 RLS를 우회한다 — 절대 브라우저로 노출하지 말 것.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET ?? "media";

export function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase 환경변수가 없습니다. NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 를 설정하세요."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
