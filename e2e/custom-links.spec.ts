import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression coverage for a data-loss bug: a custom header link, saved
 * through CustomLinksDialog, was silently reverted to the pre-edit value the
 * next time anything reloaded resume state from the database (a reload, a
 * library copy's refetch, or a version snapshot/restore). The link would
 * still *look* present right after saving, because the optimistic client
 * state showed it — the loss only became visible once something re-read the
 * database's actual row.
 *
 * This spec deliberately exercises: a full page reload, a library-copy
 * refetch (`copyBlock` → `refetchDraft`), and the checkpoint/compare/restore
 * data path, so a regression in any of those reload points is caught, not
 * just the initial optimistic render.
 */

const { email, password } = JSON.parse(
  readFileSync(join(process.cwd(), "e2e", ".auth-user.json"), "utf8"),
) as { email: string; password: string };

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(dashboard|resumes)?$|\/dashboard/, { timeout: 15_000 }).catch(() => {});
}

function sectionTitleInput(page: Page) {
  return page.getByRole("tabpanel", { name: "Resume" }).getByLabel("Section title");
}

async function createResumeAndOpen(page: Page, name: string) {
  await page.goto("/resumes");
  await page.getByRole("button", { name: "New resume" }).click();
  await page.locator("#resume-name").fill(name);
  await page.getByRole("button", { name: "Create resume" }).click();
  await expect(page.getByText(name).first()).toBeVisible();
  await page.getByRole("link", { name: "Open editor" }).first().click();
  await page.waitForURL(/\/resumes\/[0-9a-f-]+$/);
}

test("editor: custom header links survive reload, library copy refetch, and checkpoint/compare/restore", async ({
  page,
}) => {
  await login(page);
  const stamp = Date.now();

  // A library block, so we can exercise copyBlock's refetchDraft() path below.
  await page.goto("/resume-blocks");
  await page.getByRole("button", { name: "Add block" }).first().click();
  const blockDialog = page.getByRole("dialog", { name: "Add block" });
  await blockDialog.locator("#block-name").fill(`Links Block ${stamp}`);
  await blockDialog.locator("#block-default-section").fill("Experience");
  await blockDialog.locator("#block-title").fill("Intern");
  await blockDialog.locator("#block-organization").fill("Acme");
  await blockDialog.getByRole("button", { name: "Add block" }).click();
  await expect(page.getByText(`Links Block ${stamp}`)).toBeVisible({ timeout: 15_000 });

  await createResumeAndOpen(page, `E2E Links ${stamp}`);
  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill("ada@example.com");

  // Add the first custom link. The dialog flushes the write before closing,
  // so by the time it's hidden the link is expected to already be in the DB.
  await page.getByRole("button", { name: "Add custom links" }).click();
  const linksDialog = page.getByRole("dialog", { name: "Custom header links" });
  await linksDialog.getByRole("button", { name: "Add link" }).click();
  await linksDialog.locator("#link-label-0").fill("Projects");
  await linksDialog.locator("#link-url-0").fill("https://example.com/projects");
  await linksDialog.getByRole("button", { name: "Save links" }).click();
  await expect(linksDialog).toBeHidden();
  await expect(page.getByText("Projects: https://example.com/projects")).toBeVisible();

  // 1. Reload — proves the link actually reached the database.
  await page.reload();
  await expect(page.getByText("Projects: https://example.com/projects")).toBeVisible({ timeout: 15_000 });

  // 2. Add a section — must not disturb the header.
  await page.getByRole("button", { name: "Add section" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add section" });
  await addDialog.getByLabel("Section title").fill("Experience");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(sectionTitleInput(page)).toHaveValue("Experience");
  await expect(page.getByText("Projects: https://example.com/projects")).toBeVisible();

  // 3. Copy a block from the library — this runs copyBlock()'s refetchDraft(),
  // which replaces the whole client draft object from a fresh DB read.
  await page.getByRole("button", { name: "From library" }).first().click();
  await expect(page.getByText(`Links Block ${stamp}`).first()).toBeVisible();
  await page.getByRole("button", { name: `Links Block ${stamp}` }).click();
  await page.getByRole("button", { name: "Add to section" }).click();
  await expect(page.locator("[data-entry-id]")).toHaveCount(1, { timeout: 15_000 });
  await expect(page.getByText("Projects: https://example.com/projects")).toBeVisible();
  // Reload again: the refetch above must not have quietly reverted the DB row.
  await page.reload();
  await expect(page.getByText("Projects: https://example.com/projects")).toBeVisible({ timeout: 15_000 });

  // 4. Checkpoint version 1 with the link present, and confirm the snapshot
  // actually captured it (not just the live draft).
  const checkpoint = page.getByRole("button", { name: "Save checkpoint" });
  await expect(checkpoint).toBeEnabled({ timeout: 15_000 });
  await checkpoint.click();
  await expect(page.getByText(/Checkpoint saved as version 1/)).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Version history" }).click();
  const history = page.getByRole("dialog", { name: "Version history" });
  await expect(history).toBeVisible();
  const v1Row = history.locator("li").filter({ hasText: "Version 1" }).first();
  await expect(v1Row).toBeVisible();
  await v1Row.getByRole("button", { name: "View" }).click();
  await expect(history.getByText(/Read-only snapshot/)).toBeVisible();
  await expect(history.getByText("Projects: https://example.com/projects")).toBeVisible();
  await history.getByRole("button", { name: /Back to all versions/ }).click();
  await page.keyboard.press("Escape");
  await expect(history).toBeHidden();

  // 5. Change the link and checkpoint a second version.
  await page.getByRole("button", { name: "Edit 1 custom link" }).click();
  await expect(linksDialog).toBeVisible();
  await linksDialog.locator("#link-url-0").fill("https://example.com/projects-v2");
  await linksDialog.getByRole("button", { name: "Save links" }).click();
  await expect(linksDialog).toBeHidden();
  await expect(page.getByText("Projects: https://example.com/projects-v2")).toBeVisible();

  await expect(checkpoint).toBeEnabled({ timeout: 15_000 });
  await checkpoint.click();
  await expect(page.getByText(/Checkpoint saved as version 2/)).toBeVisible({ timeout: 15_000 });

  // 6. Compare current draft (v2's link) against version 1 (v1's link) — the
  // diff must report the custom-links change.
  await page.getByRole("button", { name: "Version history" }).click();
  await expect(history).toBeVisible();
  await expect(v1Row).toBeVisible();
  await v1Row.getByRole("button", { name: "Compare" }).click();
  await expect(history.getByText("Custom links")).toBeVisible();
  await history.getByRole("button", { name: /Back to all versions/ }).click();

  // 7. Restore version 1 — the original link URL must come back, atomically.
  await v1Row.getByRole("button", { name: "Restore" }).click();
  await expect(history.getByText(/Restore the draft from version 1/)).toBeVisible();
  await history.getByRole("button", { name: "Restore", exact: true }).last().click();
  await expect(history.getByText(/Restored from version 1/)).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");
  await expect(page.getByText("Projects: https://example.com/projects")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Projects: https://example.com/projects-v2")).toHaveCount(0);

  // 8. Final reload — the restored value is really persisted, not just local.
  await page.reload();
  await expect(page.getByText("Projects: https://example.com/projects")).toBeVisible({ timeout: 15_000 });
});
