import type { Tables } from "@/types/supabase";

type Event = Tables<"events">;

export function getNextEvent(
  applicationId: string,
  events: Event[],
  now: Date,
): Event | null {
  let best: Event | null = null;
  let bestTime = Infinity;
  for (const e of events) {
    if (e.application_id !== applicationId) continue;
    const t = new Date(e.event_date).getTime();
    if (t > now.getTime() && t < bestTime) {
      best = e;
      bestTime = t;
    }
  }
  return best;
}
