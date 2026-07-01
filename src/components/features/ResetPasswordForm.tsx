"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Status = "verifying" | "ready" | "invalid";

export function ResetPasswordForm() {
  const [status, setStatus] = useState<Status>("verifying");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    // Only a genuine PASSWORD_RECOVERY event proves this session came from
    // the emailed link — an ordinary getSession() check would also pass for
    // any unrelated, already-logged-in session.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStatus("ready");
      }
    });

    // A late-arriving PASSWORD_RECOVERY event (e.g. slow PKCE code exchange)
    // still overrides this via the unconditional setStatus("ready") above,
    // so a valid link can never get stuck on "invalid".
    const timeout = setTimeout(() => {
      setStatus((current) => (current === "verifying" ? "invalid" : current));
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    router.push("/login?reset=success");
  }

  if (status === "invalid") {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            This reset link is invalid or has expired.
          </p>
          <p className="mt-2 text-center text-sm text-gray-500">
            If you opened it on a different device or browser than the one
            you requested it from, try opening it there instead.
          </p>
          <p className="mt-4 text-center text-sm text-gray-500">
            <Link
              href="/forgot-password"
              className="text-gray-900 underline dark:text-gray-100"
            >
              Request a new link
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === "verifying") {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-sm text-gray-500">Verifying link…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={6}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={6}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Updating…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
