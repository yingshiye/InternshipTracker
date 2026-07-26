import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

/**
 * The inline section-title input in the rendered resume. Scoped to the resume
 * pane because the "Add section" dialog has a field with the same label, and
 * Radix keeps a closing dialog mounted through its exit animation — so an
 * unscoped lookup is ambiguous for a moment right after the dialog closes.
 */
function sectionTitleInput(page: Page) {
  return page.getByRole("tabpanel", { name: "Resume" }).getByLabel("Section title");
}

async function createResumeAndOpen(page: Page, name: string) {
  await page.goto("/resumes");
  await page.getByRole("button", { name: "New resume" }).click();
  await page.locator("#resume-name").fill(name);
  await page.getByRole("button", { name: "Create resume" }).click();
  // Open the editor for the row we just created.
  const row = page.locator("div", { hasText: name }).first();
  await expect(page.getByText(name).first()).toBeVisible();
  await page.getByRole("link", { name: "Open editor" }).first().click();
  await page.waitForURL(/\/resumes\/[0-9a-f-]+$/);
  void row;
}

test("signed-out access to the editor routes redirects to /login", async ({ page }) => {
  await page.goto("/resumes");
  await expect(page).toHaveURL(/\/login/);
});

test("opening a dialog does not emit a missing-description a11y warning", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "warning" || msg.type() === "error") warnings.push(msg.text());
  });
  await login(page);
  await page.goto("/resumes");
  await page.getByRole("button", { name: "New resume" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // The dialog must be described (aria-describedby present and resolvable).
  const describedBy = await page.getByRole("dialog").getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  expect(warnings.some((w) => w.includes("Missing `Description`") || w.includes("aria-describedby"))).toBeFalsy();
});

test("editor: create, add section, add entry, edit header, add bullet, and persist", async ({ page }) => {
  await login(page);
  const name = `E2E Resume ${Date.now()}`;
  await createResumeAndOpen(page, name);

  // Add a section. The field is scoped to the dialog: once the section
  // exists, "Section title" also matches the inline input in the preview.
  await page.getByRole("button", { name: "Add section" }).click();
  const addSectionDialog = page.getByRole("dialog", { name: "Add section" });
  await expect(addSectionDialog).toBeVisible();
  await addSectionDialog.getByLabel("Section title").fill("Experience");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(sectionTitleInput(page)).toHaveValue("Experience");

  // Add a custom entry, then a bullet.
  await page.getByRole("button", { name: "Add entry" }).click();
  await expect(page.locator("[data-entry-id]")).toHaveCount(1);
  await page.getByRole("button", { name: "Add bullet" }).click();
  await expect(page.locator("[data-bullet-id]")).toHaveCount(1);

  // Edit the header name.
  await page.getByLabel("Full name").fill("Ada Lovelace");

  // Give autosave time to flush, then reload and confirm persistence.
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByLabel("Full name")).toHaveValue("Ada Lovelace");
  await expect(sectionTitleInput(page)).toHaveValue("Experience");
  await expect(page.locator("[data-bullet-id]")).toHaveCount(1);
});

test("editor: style change updates the target-length setting and persists", async ({ page }) => {
  await login(page);
  const name = `E2E Style ${Date.now()}`;
  await createResumeAndOpen(page, name);

  await page.getByRole("combobox", { name: /Target length/i }).selectOption("two_pages").catch(async () => {
    // fall back to the native select label association
    await page.locator("text=Target length").locator("xpath=following::select[1]").selectOption("two_pages");
  });
  await page.waitForTimeout(1000);
  await page.reload();
  // The two-pages option should be selected after reload.
  const select = page.locator("text=Target length").locator("xpath=following::select[1]");
  await expect(select).toHaveValue("two_pages");
});

/**
 * Step 3: the version lifecycle end to end in a real browser — checkpoint,
 * history, read-only snapshot, comparison, and restore.
 */
test("editor: save checkpoint, view the snapshot, compare, and restore", async ({ page }) => {
  await login(page);
  const name = `E2E Versions ${Date.now()}`;
  await createResumeAndOpen(page, name);

  // Build enough of a resume to be worth versioning.
  await page.getByRole("button", { name: "Add section" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add section" });
  await addDialog.getByLabel("Section title").fill("Experience");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(sectionTitleInput(page)).toHaveValue("Experience");

  await page.getByRole("button", { name: "Add entry" }).click();
  await expect(page.locator("[data-entry-id]")).toHaveCount(1);
  await page.getByLabel("Entry title").fill("Original title");
  await page.getByLabel("Full name").fill("Ada Lovelace");

  // "Save checkpoint" stays disabled until the draft is actually persisted —
  // a checkpoint records the server's state, not the screen's.
  const checkpoint = page.getByRole("button", { name: "Save checkpoint" });
  await expect(checkpoint).toBeEnabled({ timeout: 15_000 });
  await checkpoint.click();
  await expect(page.getByText(/Checkpoint saved as version 1/)).toBeVisible({ timeout: 15_000 });

  // Change the draft so there is something to compare and restore.
  await page.getByLabel("Entry title").fill("Changed title");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Version history" }).click();
  const history = page.getByRole("dialog", { name: "Version history" });
  await expect(history).toBeVisible();
  // Scoped to the list row: "Version 1" also appears as an <option> in the
  // compare-against picker.
  const versionRow = history.locator("li").filter({ hasText: "Version 1" }).first();
  await expect(versionRow).toBeVisible();

  // The read-only snapshot shows the pre-change text and says it is read-only.
  await history.getByRole("button", { name: "View" }).first().click();
  await expect(history.getByText(/Read-only snapshot/)).toBeVisible();
  await expect(history.getByText("Original title")).toBeVisible();
  await history.getByRole("button", { name: /Back to all versions/ }).click();

  // Comparing the current draft against version 1 reports the edit.
  await history.getByRole("button", { name: "Compare" }).first().click();
  await expect(history.getByText("Changed").first()).toBeVisible();
  await history.getByRole("button", { name: /Back to all versions/ }).click();

  // Restore, confirm, and check the draft actually went back.
  await history.getByRole("button", { name: "Restore" }).first().click();
  await expect(history.getByText(/Restore the draft from version 1/)).toBeVisible();
  await history.getByRole("button", { name: "Restore", exact: true }).last().click();
  await expect(history.getByText(/Restored from version 1/)).toBeVisible({ timeout: 15_000 });

  // The version survives its own restore.
  await expect(history.locator("li").filter({ hasText: "Version 1" }).first()).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Entry title")).toHaveValue("Original title", { timeout: 15_000 });
});

test("editor: the export dialog runs preflight and blocks an unexportable resume", async ({ page }) => {
  await login(page);
  const name = `E2E Export ${Date.now()}`;
  await createResumeAndOpen(page, name);

  await page.getByRole("button", { name: "Export PDF" }).click();
  const exportDialog = page.getByRole("dialog", { name: "Export to PDF" });
  await expect(exportDialog).toBeVisible();

  // A brand-new resume has no name and no content, so preflight must block.
  await expect(exportDialog.getByText("Must fix before exporting")).toBeVisible();
  await expect(exportDialog.getByText("The resume has no full name.")).toBeVisible();
  await expect(exportDialog.getByText("The resume has no content to export.")).toBeVisible();

  // The suggested filename falls back rather than inventing one, and carries
  // no id of any kind.
  await expect(exportDialog.getByText(/^Resume_\d{4}-\d{2}-\d{2}\.pdf$/)).toBeVisible();
});
