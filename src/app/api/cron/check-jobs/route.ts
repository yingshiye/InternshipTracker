import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAuthorized, runCheckJobs } from "./logic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!isAuthorized(authHeader, process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { status, body } = await runCheckJobs(supabase);
  return NextResponse.json(body, { status });
}
