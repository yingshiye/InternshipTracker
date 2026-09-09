"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/utils";
import { DEFAULT_LOCATION_OPTIONS, DEFAULT_ROLE_OPTIONS } from "@/lib/constants/fieldOptions";

const SUPABASE_TIMEOUT_MS = 10_000;

type FieldName = "role" | "location";
type SavedOption = { value: string; hidden: boolean };

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
  const [savedOptions, setSavedOptions] = useState<SavedOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();

    withTimeout(
      supabase
        .from("user_field_options")
        .select("value, hidden")
        .eq("user_id", userId)
        .eq("field", field),
      SUPABASE_TIMEOUT_MS
    ).then(({ data, error }) => {
      if (cancelled || error || !data) return;
      setSavedOptions(data);
    });

    return () => {
      cancelled = true;
    };
  }, [field, userId]);

  const hiddenOptionKeys = new Set(
    savedOptions
      .filter((option) => option.hidden)
      .map((option) => option.value.toLowerCase())
  );
  const options = dedupe([
    ...DEFAULTS[field].filter(
      (option) => !hiddenOptionKeys.has(option.toLowerCase())
    ),
    ...savedOptions
      .filter((option) => !option.hidden)
      .map((option) => option.value),
  ]);

  async function addOption(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (options.some((o) => o.toLowerCase() === trimmed.toLowerCase())) return;

    const previous = savedOptions;
    const savedOption = savedOptions.find(
      (option) => option.value.toLowerCase() === trimmed.toLowerCase()
    );
    const storedValue = savedOption?.value ?? trimmed;
    setSavedOptions((prev) => [
      ...prev.filter((option) => option.value !== storedValue),
      { value: storedValue, hidden: false },
    ]);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await withTimeout(
        supabase
          .from("user_field_options")
          .upsert(
            { user_id: userId, field, value: storedValue, hidden: false },
            { onConflict: "user_id,field,value" }
          ),
        SUPABASE_TIMEOUT_MS
      );

      if (error) throw error;
    } catch {
      setSavedOptions(previous);
    }
  }

  async function removeOption(value: string) {
    const visibleValue = options.find(
      (option) => option.toLowerCase() === value.trim().toLowerCase()
    );
    if (!visibleValue) return;

    const defaultValue = DEFAULTS[field].find(
      (option) => option.toLowerCase() === visibleValue.toLowerCase()
    );
    const savedOption = savedOptions.find(
      (option) => option.value.toLowerCase() === visibleValue.toLowerCase()
    );
    const storedValue = defaultValue ?? savedOption?.value;
    if (!storedValue) return;

    const previous = savedOptions;
    setSavedOptions((prev) =>
      defaultValue
        ? [
            ...prev.filter((option) => option.value !== storedValue),
            { value: storedValue, hidden: true },
          ]
        : prev.filter((option) => option.value !== storedValue)
    );

    try {
      const supabase = getSupabaseBrowserClient();
      const query = defaultValue
        ? supabase.from("user_field_options").upsert(
            { user_id: userId, field, value: storedValue, hidden: true },
            { onConflict: "user_id,field,value" }
          )
        : supabase
            .from("user_field_options")
            .delete()
            .eq("user_id", userId)
            .eq("field", field)
            .eq("value", storedValue);
      const { error } = await withTimeout(query, SUPABASE_TIMEOUT_MS);

      if (error) throw error;
    } catch {
      setSavedOptions(previous);
    }
  }

  return { options, addOption, removeOption };
}
