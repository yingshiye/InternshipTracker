import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Code2,
  LayoutDashboard,
  Eye,
  FileText,
  Sparkles,
  ListChecks,
  Wand2,
} from "lucide-react";

const REPO_URL = "https://github.com/yingshiye/InternshipTracker";

const features = [
  {
    icon: LayoutDashboard,
    title: "One pipeline, not ten spreadsheets",
    description:
      "Every application lives in one board — status, next step, and upcoming events at a glance, filterable by stage from wishlist to offer.",
    image: "/marketing/dashboard.png",
    imageAlt: "Internship Tracker dashboard showing a list of applications and pipeline stats",
    width: 1440,
    height: 760,
  },
  {
    icon: FileText,
    title: "A resume editor built for tailoring",
    description:
      "Keep a library of bullets and entries, then assemble a fitted, one-page resume per role in minutes — with live fit checks and instant PDF export.",
    image: "/marketing/resume-editor.png",
    imageAlt: "Resume editor with a module library, live preview, and formatting settings",
    width: 1440,
    height: 900,
  },
  {
    icon: Eye,
    title: "Know the moment a posting changes",
    description:
      "Add a careers page to your watchlist and a background job checks it on a schedule, flagging changes before the role disappears.",
    image: "/marketing/watchlist.png",
    imageAlt: "Watchlist page tracking a company careers page for changes",
    width: 1440,
    height: 380,
  },
];

const steps = [
  {
    title: "Log the role",
    description: "Add a company, role, and status the moment you apply — takes about ten seconds.",
  },
  {
    title: "Build a tailored resume",
    description: "Pull bullets from your library, arrange them for the role, and export a clean PDF.",
  },
  {
    title: "Stay ahead of deadlines",
    description: "Watchlist alerts and the upcoming-events feed keep next steps from slipping through.",
  },
];

const stack = [
  "Next.js 16",
  "Supabase",
  "PostgreSQL",
  "TypeScript",
  "Tailwind CSS",
  "shadcn/ui",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#08080b] text-white/90 antialiased">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-10%] h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute right-[-10%] top-[30%] h-[400px] w-[500px] rounded-full bg-violet-600/10 blur-[120px]" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-white text-xs font-bold text-black">
            IT
          </div>
          <span className="text-sm font-semibold tracking-tight">Internship Tracker</span>
        </div>
        <nav className="hidden items-center gap-8 text-sm text-white/60 md:flex">
          <a href="#features" className="transition-colors hover:text-white">
            Features
          </a>
          <a href="#how-it-works" className="transition-colors hover:text-white">
            How it works
          </a>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="transition-colors hover:text-white">
            Source
          </a>
        </nav>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-white/70 transition-colors hover:text-white sm:inline"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-90"
          >
            Sign up
          </Link>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto flex max-w-4xl flex-col items-center px-6 pt-20 pb-16 text-center">
          <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
            <Sparkles className="size-3.5" />
            A solo full-stack project, live in production
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
            Every internship application,
            <br className="hidden sm:block" /> tracked in one place.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/60 text-balance">
            I built Internship Tracker to run my own internship search — a pipeline board,
            a resume editor that tailors bullets per role, and alerts when a careers page
            changes. No more spreadsheets and a dozen open tabs.
          </p>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90"
            >
              Try it live
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/5"
            >
              <Code2 className="size-4" />
              View source
            </a>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] shadow-[0_0_80px_-20px_rgba(59,130,246,0.25)]">
            <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/[0.03] px-4 py-3">
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="size-2.5 rounded-full bg-white/15" />
            </div>
            <Image
              src="/marketing/dashboard.png"
              alt="Internship Tracker dashboard"
              width={1440}
              height={760}
              className="w-full"
              priority
            />
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-6 py-28">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything the search actually needs
            </h2>
            <p className="mt-4 text-white/60">
              Three tools that cover the whole loop — apply, tailor, and follow up —
              instead of a generic to-do list wearing a job-search skin.
            </p>
          </div>

          <div className="space-y-24">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className={`flex flex-col gap-10 lg:flex-row lg:items-center ${
                  index % 2 === 1 ? "lg:flex-row-reverse" : ""
                }`}
              >
                <div className="lg:w-2/5">
                  <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                    <feature.icon className="size-5 text-blue-400" />
                  </div>
                  <h3 className="text-2xl font-semibold tracking-tight">{feature.title}</h3>
                  <p className="mt-3 text-white/60">{feature.description}</p>
                </div>
                <div className="lg:w-3/5">
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                    <Image
                      src={feature.image}
                      alt={feature.imageAlt}
                      width={feature.width}
                      height={feature.height}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-5xl px-6 py-28">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
            <p className="mt-4 text-white/60">Three steps, repeated for every role you apply to.</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                <div className="mb-4 text-sm font-mono text-blue-400">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-white/60">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-16">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-6 py-10 sm:px-10">
            <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2 text-sm text-white/50">
                  <Wand2 className="size-4" />
                  Built end to end, solo
                </div>
                <p className="mt-2 max-w-lg text-white/70">
                  Auth, database schema and RLS policies, a scheduled job for watchlist checks,
                  drag-and-drop resume editing, and PDF export — all designed and shipped by one person.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {stack.map((tech) => (
                  <span
                    key={tech}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-xs text-white/60"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 py-28 text-center">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
            <ListChecks className="size-3.5" />
            Free to use, no credit card
          </div>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Stop tracking your search in a spreadsheet.
          </h2>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90"
            >
              Create a free account
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/5"
            >
              Sign in
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-white/40 sm:flex-row">
          <span>Built by Yingshi Ye</span>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-white/70">
            <Code2 className="size-4" />
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
