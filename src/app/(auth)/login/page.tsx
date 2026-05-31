import type { Metadata } from "next";
import { LoginForm } from "@/components/features/LoginForm";

export const metadata: Metadata = {
  title: "Sign in — Internship Tracker",
};

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-medium text-gray-900 dark:text-gray-100">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Track your internship applications
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
