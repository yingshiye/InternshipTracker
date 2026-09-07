import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/features/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset password — Internship Tracker",
};

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Forgot your password?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
