import type { EducationData } from "@/lib/resume/types";

/**
 * Joins degree + field_of_study for entries that still carry both as
 * separate fields, from before the education editor combined them into one
 * "Degree" input.
 */
export function educationSubtitle(edu: Pick<EducationData, "degree" | "field_of_study"> | null | undefined): string {
  return [edu?.degree, edu?.field_of_study].filter(Boolean).join(", ");
}

/**
 * minor/gpa/honors/coursework/details have no editor UI any more (the
 * education editor only writes `degree` now), but existing resumes/library
 * blocks may still carry this data. Shared by every place an education entry
 * is rendered (live editor, version snapshots, print/export) so it can never
 * be visible in one and silently missing in another.
 */
export function EducationExtraLines({ edu }: { edu: EducationData | null | undefined }) {
  if (!edu) return null;
  const hasAny =
    edu.minor || edu.gpa || (edu.honors && edu.honors.length > 0) || (edu.coursework && edu.coursework.length > 0) || (edu.details && edu.details.length > 0);
  if (!hasAny) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {edu.minor && <span>Minor: {edu.minor}</span>}
      {edu.gpa && <span>GPA: {edu.gpa}</span>}
      {edu.honors && edu.honors.length > 0 && <span>Honors: {edu.honors.join(", ")}</span>}
      {edu.coursework && edu.coursework.length > 0 && <span>Relevant coursework: {edu.coursework.join(", ")}</span>}
      {edu.details?.map((d, i) => <span key={i}>{d}</span>)}
    </div>
  );
}
