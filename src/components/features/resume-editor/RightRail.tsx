"use client";

import { SettingsPanel } from "./SettingsPanel";
import { ResumeCheckPanel } from "./ResumeCheckPanel";

export function RightRail({ userId }: { userId: string }) {
  return (
    <aside className="flex flex-col overflow-y-auto border-l border-gray-100 dark:border-gray-800">
      <SettingsPanel />
      <ResumeCheckPanel userId={userId} />
    </aside>
  );
}
