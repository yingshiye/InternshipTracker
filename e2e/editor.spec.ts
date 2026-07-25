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

  // Add a section.
  await page.getByRole("button", { name: "Add section" }).click();
  await expect(page.getByRole("dialog", { name: "Add section" })).toBeVisible();
  await page.getByPlaceholder("Section title").fill("Experience");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel("Section title")).toHaveValue("Experience");

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
  await expect(page.getByLabel("Section title")).toHaveValue("Experience");
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
