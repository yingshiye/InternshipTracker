import type { Metadata } from "next";
import { SignupForm } from "@/components/features/SignupForm";

export const metadata: Metadata = {
  title: "Create account — Internship Tracker",
};

export default function SignupPage() {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-medium text-gray-900 dark:text-gray-100">
          Create an account
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Start tracking your internship applications
        </p>
      </div>
      <SignupForm />
    </div>
  );
}
