"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LogIn, Mail, Lock } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GoogleIcon } from "@/components/ui/google-icon";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "success";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 pt-6 pb-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LogIn className="size-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Sign in with email
          </h1>
          <p className="mt-1 max-w-2xs text-sm text-muted-foreground">
            Pick up your internship search right where you left off.
          </p>
        </div>
      </CardContent>
      <CardContent className="flex flex-col gap-4">
        {resetSuccess && (
          <p className="text-center text-sm text-emerald-600 dark:text-emerald-400">
            Your password has been updated. Sign in with your new password.
          </p>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="pl-8"
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          Or sign in with
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
        >
          <GoogleIcon className="size-4" />
          {googleLoading ? "Redirecting…" : "Continue with Google"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-foreground underline">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
