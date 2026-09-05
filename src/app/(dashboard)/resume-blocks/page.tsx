import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ResumeBlocksPanel } from "@/components/features/ResumeBlocksPanel";

export default async function ResumeBlocksPage() {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: blocks } = await supabase
    .from("resume_library_blocks")
    .select("*")
    .order("sort_order", { ascending: true });

  const { data: bullets } = await supabase
    .from("resume_library_bullets")
    .select("*")
    .order("sort_order", { ascending: true });

  const { data: resumes } = await supabase
    .from("resumes")
    .select("*")
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  const { data: sections } = await supabase
    .from("resume_sections")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-medium text-gray-900 dark:text-gray-100">
          Resume blocks
        </h1>
        <p className="text-sm text-gray-500">
          Your reusable library of experience, education, and skills blocks.
        </p>
      </div>
      <ResumeBlocksPanel blocks={blocks ?? []} bullets={bullets ?? []} resumes={resumes ?? []} sections={sections ?? []} userId={user.id} />
    </div>
  );
}
