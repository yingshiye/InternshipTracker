import type { Metadata } from "next";
import { SignupForm } from "@/components/features/SignupForm";

export const metadata: Metadata = {
  title: "Create account — Internship Tracker",
};

export default function SignupPage() {
  return (
    <div className="w-full max-w-sm">
      <SignupForm />
    </div>
  );
}
