import { notFound, redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { loadResumeDraft } from "@/lib/resume/draft";
import { ResumeEditor } from "@/components/features/resume-editor/ResumeEditor";
import type { SubmitTargetApplication } from "@/components/features/resume-editor/SubmitForApplicationPanel";

export default async function ResumeEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ resumeId: string }>;
  // `?application=<id>` is how the application flow hands off to the editor.
  // Only an id travels in the URL — never resume content.
  searchParams: Promise<{ application?: string }>;
}) {
  const { resumeId } = await params;
  const { application: applicationId } = await searchParams;
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const draft = await loadResumeDraft(supabase, resumeId);
  if (!draft) notFound();

  const [{ data: blocks }, { data: bullets }] = await Promise.all([
    supabase.from("resume_library_blocks").select("*").order("sort_order", { ascending: true }),
    supabase.from("resume_library_bullets").select("*").order("sort_order", { ascending: true }),
  ]);

  let application: SubmitTargetApplication | null = null;
  if (applicationId) {
    // RLS scopes this to the signed-in user, so an id belonging to someone
    // else simply resolves to nothing.
    const { data } = await supabase
      .from("applications")
      .select("id, company, role, submitted_resume_version_id")
      .eq("id", applicationId)
      .maybeSingle();
    if (data) application = data as SubmitTargetApplication;
  }

  return (
    <ResumeEditor
      initialDraft={draft}
      library={{ blocks: blocks ?? [], bullets: bullets ?? [] }}
      userId={user.id}
      application={application}
    />
  );
}
