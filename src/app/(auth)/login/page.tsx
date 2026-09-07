import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/features/LoginForm";

export const metadata: Metadata = {
  title: "Sign in — Internship Tracker",
};

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track your internship applications
        </p>
      </div>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
