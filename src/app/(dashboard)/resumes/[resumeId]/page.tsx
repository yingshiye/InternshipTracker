import { notFound, redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { loadResumeDraft } from "@/lib/resume/draft";
import { ResumeEditor } from "@/components/features/resume-editor/ResumeEditor";

export default async function ResumeEditorPage({ params }: { params: Promise<{ resumeId: string }> }) {
  const { resumeId } = await params;
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

  return (
    <ResumeEditor
      initialDraft={draft}
      library={{ blocks: blocks ?? [], bullets: bullets ?? [] }}
      userId={user.id}
    />
  );
}
