import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// Server-only. Never import this in Client Components or expose to the browser.
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
