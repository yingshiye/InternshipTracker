import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ResumesPanel } from "@/components/features/ResumesPanel";

export default async function ResumesPage() {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: activeResumes } = await supabase
    .from("resumes")
    .select("*")
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  const { data: archivedResumes } = await supabase
    .from("resumes")
    .select("*")
    .not("archived_at", "is", null)
    .order("updated_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-medium text-gray-900 dark:text-gray-100">
          Resumes
        </h1>
        <p className="text-sm text-gray-500">
          Manage your resume drafts. The visual editor is coming in a later step.
        </p>
      </div>
      <ResumesPanel activeResumes={activeResumes ?? []} archivedResumes={archivedResumes ?? []} />
    </div>
  );
}
