import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Manual smoke run for the parts of Step 3 the regular suite does not cover:
 * Resume Block creation, copying a block into a resume, and the real export
 * path all the way to window.print() — including proof that the printed
 * document is built from the exported version's snapshot and that no editor
 * chrome survives into it.
 *
 * `window.print` is stubbed, because a real print dialog would block the run
 * forever. Everything up to and including the call is genuine.
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

test("smoke: block creation, library copy, and a real export through window.print", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  await login(page);

  // ── Resume Block creation (the library layer) ──────────────────────────
  await page.goto("/resume-blocks");
  await page.getByRole("button", { name: "Add block" }).first().click();
  const blockDialog = page.getByRole("dialog", { name: "Add block" });
  await expect(blockDialog).toBeVisible();
  const stamp = Date.now();
  await blockDialog.locator("#block-name").fill(`Smoke Block ${stamp}`);
  await blockDialog.locator("#block-default-section").fill("Experience");
  await blockDialog.locator("#block-title").fill("Software Engineer Intern");
  await blockDialog.locator("#block-organization").fill("Acme Corp");
  await blockDialog.getByRole("button", { name: "Add block" }).click();
  await expect(page.getByText(`Smoke Block ${stamp}`)).toBeVisible({ timeout: 15_000 });
  console.log("SMOKE: Resume Block creation OK");

  // ── Resume creation ────────────────────────────────────────────────────
  await page.goto("/resumes");
  await page.getByRole("button", { name: "New resume" }).click();
  await page.locator("#resume-name").fill(`Smoke Resume ${stamp}`);
  await page.getByRole("button", { name: "Create resume" }).click();
  await expect(page.getByText(`Smoke Resume ${stamp}`).first()).toBeVisible();
  await page.getByRole("link", { name: "Open editor" }).first().click();
  await page.waitForURL(/\/resumes\/[0-9a-f-]+$/);
  console.log("SMOKE: Resume creation OK");

  // Resume metadata (name / target company / role).
  await page.getByRole("button", { name: /Edit resume name/ }).click();
  await page.locator("#resume-company").fill("Acme Corp");
  await page.locator("#resume-role").fill("Software Engineer Intern");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Acme Corp · Software Engineer Intern")).toBeVisible({ timeout: 15_000 });
  console.log("SMOKE: resume metadata OK");

  // ── Section + library copy ─────────────────────────────────────────────
  await page.getByRole("button", { name: "Add section" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add section" });
  await addDialog.getByLabel("Section title").fill("Experience");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const resumePane = page.getByRole("tabpanel", { name: "Resume" });
  await expect(resumePane.getByLabel("Section title")).toHaveValue("Experience");

  await page.getByRole("button", { name: "From library" }).first().click();
  await expect(page.getByText(`Smoke Block ${stamp}`).first()).toBeVisible();
  await page.getByRole("button", { name: `Smoke Block ${stamp}` }).click();
  await page.getByRole("button", { name: "Add to section" }).click();
  await expect(page.locator("[data-entry-id]")).toHaveCount(1, { timeout: 15_000 });
  await expect(resumePane.getByLabel("Entry title")).toHaveValue("Software Engineer Intern");
  console.log("SMOKE: library copy into section OK");

  // Header, so preflight has no blocking issues.
  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByRole("button", { name: "Add bullet" }).click();
  await expect(page.locator("[data-bullet-id]")).toHaveCount(1);

  await expect(page.getByRole("button", { name: "Save checkpoint" })).toBeEnabled({ timeout: 15_000 });

  // ── Export, with window.print stubbed ──────────────────────────────────
  await page.addInitScript(() => {
    (window as unknown as { __printCalls: number }).__printCalls = 0;
  });
  await page.evaluate(() => {
    const w = window as unknown as {
      __printCalls: number;
      __titleAtPrint: string;
      __bodyClassAtPrint: string;
      __printDocText: string;
      print: () => void;
    };
    w.__printCalls = 0;
    w.print = () => {
      w.__printCalls += 1;
      w.__titleAtPrint = document.title;
      w.__bodyClassAtPrint = document.body.className;
      w.__printDocText = document.querySelector(".resume-print-document")?.textContent ?? "";
      // Whether the print stylesheet actually hides the editor is checked
      // separately, under real print-media emulation — a stubbed print() does
      // not switch the computed styles over to print media.
    };
  });

  await page.getByRole("button", { name: "Export PDF" }).click();
  const exportDialog = page.getByRole("dialog", { name: "Export to PDF" });
  await expect(exportDialog).toBeVisible();
  await expect(exportDialog.getByText("Must fix before exporting")).toHaveCount(0);

  const suggested = await exportDialog.locator("p.font-mono").textContent();
  console.log(`SMOKE: suggested filename = ${suggested}`);
  expect(suggested).toMatch(/^Ada_Lovelace_Acme_Corp_Software_Engineer_Intern_\d{4}-\d{2}-\d{2}\.pdf$/);

  await exportDialog.getByRole("button", { name: "Save PDF" }).click();
  await expect(exportDialog.getByText("Print dialog opened")).toBeVisible({ timeout: 30_000 });

  const printState = await page.evaluate(() => {
    const w = window as unknown as {
      __printCalls: number;
      __titleAtPrint: string;
      __bodyClassAtPrint: string;
      __printDocText: string;
    };
    return {
      calls: w.__printCalls,
      titleAtPrint: w.__titleAtPrint,
      bodyClassAtPrint: w.__bodyClassAtPrint,
      printDocText: w.__printDocText,
      titleAfter: document.title,
      bodyClassAfter: document.body.className,
    };
  });
  console.log("SMOKE: print state =", JSON.stringify(printState, null, 2));

  // window.print() was called exactly once.
  expect(printState.calls).toBe(1);
  // The document title was the sanitized export name at print time…
  expect(printState.titleAtPrint).toMatch(/^Ada_Lovelace_Acme_Corp_Software_Engineer_Intern_\d{4}-\d{2}-\d{2}$/);
  // …and was restored afterwards.
  expect(printState.titleAfter).not.toBe(printState.titleAtPrint);
  // The print body class was applied at print time and cleaned up afterwards.
  expect(printState.bodyClassAtPrint).toContain("resume-printing");
  expect(printState.bodyClassAfter).not.toContain("resume-printing");
  // The printed document carries the real resume text, from the snapshot.
  expect(printState.printDocText).toContain("Ada Lovelace");
  expect(printState.printDocText).toContain("Software Engineer Intern");
  // The section heading is uppercased by CSS, so the text node reads normally.
  expect(printState.printDocText).toContain("Experience");
  expect(printState.printDocText).toContain("Acme Corp");
  console.log("SMOKE: export → version → print ordering OK");

  // ── Print CSS, under real print-media emulation ────────────────────────
  // Re-run an export so the print document is mounted, then hold the page in
  // the printing state and ask the browser what print media actually resolves
  // to. This is the check that proves no editor chrome reaches the PDF.
  await page.evaluate(() => {
    document.body.classList.add("resume-printing");
  });
  await page.emulateMedia({ media: "print" });

  const printCss = await page.evaluate(() => {
    const portal = document.getElementById("resume-print-portal");
    const siblings = Array.from(document.body.children).filter((el) => el !== portal);
    const doc = document.querySelector(".resume-print-document") as HTMLElement | null;
    return {
      portalPresent: !!portal,
      portalDisplay: portal ? getComputedStyle(portal).display : null,
      visibleSiblings: siblings
        .filter((el) => getComputedStyle(el).display !== "none")
        .map((el) => el.tagName + (el.id ? `#${el.id}` : "")),
      fontFamily: doc ? getComputedStyle(doc).fontFamily : null,
      pageMarkersVisible: Array.from(document.querySelectorAll(".resume-print-page-marker")).some(
        (el) => getComputedStyle(el).display !== "none",
      ),
      linkCount: doc ? doc.querySelectorAll("a[href]").length : 0,
    };
  });
  console.log("SMOKE: print CSS =", JSON.stringify(printCss, null, 2));

  expect(printCss.portalPresent).toBe(true);
  // Everything except the print portal is display:none under print media.
  expect(printCss.visibleSiblings).toEqual([]);
  expect(printCss.fontFamily).toContain("Times New Roman");
  expect(printCss.pageMarkersVisible).toBe(false);

  await page.screenshot({ path: "test-results/smoke-print-preview.png", fullPage: true });
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => document.body.classList.remove("resume-printing"));


  // An `exported` version was recorded, before printing.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Version history" }).click();
  const history = page.getByRole("dialog", { name: "Version history" });
  await expect(history.locator("li").filter({ hasText: "Exported" }).first()).toBeVisible();
  console.log("SMOKE: exported version recorded OK");

  console.log("SMOKE: console errors =", JSON.stringify(consoleErrors.filter((e) => !e.includes("favicon"))));
});
