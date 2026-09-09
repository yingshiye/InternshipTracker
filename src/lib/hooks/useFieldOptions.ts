"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/utils";
import { DEFAULT_LOCATION_OPTIONS, DEFAULT_ROLE_OPTIONS } from "@/lib/constants/fieldOptions";

const SUPABASE_TIMEOUT_MS = 10_000;

type FieldName = "role" | "location";

const DEFAULTS: Record<FieldName, string[]> = {
  role: DEFAULT_ROLE_OPTIONS,
  location: DEFAULT_LOCATION_OPTIONS,
};

function dedupe(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

export function useFieldOptions(field: FieldName, userId: string) {
  const [customOptions, setCustomOptions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();

    withTimeout(
      supabase
        .from("user_field_options")
        .select("value")
        .eq("user_id", userId)
        .eq("field", field),
      SUPABASE_TIMEOUT_MS
    ).then(({ data, error }) => {
      if (cancelled || error || !data) return;
      setCustomOptions(data.map((row) => row.value));
    });

    return () => {
      cancelled = true;
    };
  }, [field, userId]);

  const options = dedupe([...DEFAULTS[field], ...customOptions]);

  async function addOption(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (options.some((o) => o.toLowerCase() === trimmed.toLowerCase())) return;

    setCustomOptions((prev) => [...prev, trimmed]);

    const supabase = getSupabaseBrowserClient();
    await withTimeout(
      supabase
        .from("user_field_options")
        .upsert(
          { user_id: userId, field, value: trimmed },
          { onConflict: "user_id,field,value", ignoreDuplicates: true }
        ),
      SUPABASE_TIMEOUT_MS
    );
  }

  return { options, addOption };
}
