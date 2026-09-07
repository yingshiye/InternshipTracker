import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex h-14 items-center px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
            IT
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Internship Tracker
          </span>
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 pb-14">
        {children}
      </div>
    </div>
  );
}
