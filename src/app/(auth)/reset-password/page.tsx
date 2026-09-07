import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/features/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Set new password — Internship Tracker",
};

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Set a new password
        </h1>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
