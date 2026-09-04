# Internship Tracker UI / Resume Editor Handoff

Last updated: 2026-09-03

## Current state

- Working branch: `main`
- Main implementation commit: `131ef9b` (`Redesign dashboard and improve resume editor UX`)
- The implementation commit has been pushed to `origin/main`.
- Existing routes, Supabase calls, data contracts, and business logic were intentionally preserved.

Before changing UI, read `AGENTS.md`, `DESIGN.md`, and `TASTE.md`. This project uses Next.js 16.2.6; consult the applicable documentation in `node_modules/next/dist/docs/` before changing framework-level code.

## What changed

### Dashboard shell

The dashboard now uses a shared responsive shell with:

- Collapsible desktop sidebar
- Mobile navigation drawer
- Active navigation states
- Light/dark theme control
- Consistent content width, spacing, and navigation hierarchy
- Existing changed-application count retained in navigation

Primary files:

- `src/components/features/DashboardShell.tsx`
- `src/app/(dashboard)/layout.tsx`
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/globals.css`

The visual direction was adapted from the selected 21st.dev dashboard reference, without copying its demo content.

### Dashboard overview and applications table

The four metrics remain Applications, Online Assessments, Interviews, and Offers. Their presentation was made more compact and less decorative.

The applications surface was revised for clearer information density, hover behavior, statuses, contextual row actions, and responsive behavior. Existing application actions and database behavior remain unchanged.

Primary files:

- `src/components/features/StatsBar.tsx`
- `src/components/features/ApplicationList.tsx`
- `src/components/features/ApplicationRow.tsx`
- `src/components/features/UpcomingPanel.tsx`

### Date selection

Browser-native date/month controls were replaced with a shared picker family. It provides consistent date, date-time, and month/year selection and is now used by application forms, event forms, and resume block date fields.

Primary files:

- `src/components/ui/date-picker.tsx`
- `src/components/features/AddApplicationModal.tsx`
- `src/components/features/EditApplicationModal.tsx`
- `src/components/features/AddEventModal.tsx`
- `src/components/features/LibraryBlockTypeFields.tsx`

When extending date inputs, reuse this component instead of adding another picker style.

### Resume editor layout and accessibility

Resume entry controls were moved out of the printable date row so controls do not collide with long dates or right-aligned metadata. Empty dates no longer imply `Present`. Bullet action labels now include entry and bullet context for screen-reader users.

Primary files:

- `src/components/features/resume-editor/EntryCard.tsx`
- `src/components/features/resume-editor/BulletList.tsx`

### Page simulation now matches PDF rendering

The editable preview previously measured a different DOM/layout from the PDF renderer. This could report two simulated pages while the exported PDF contained one page.

The editor now mounts an offscreen, non-interactive copy of the actual print document and measures that print-faithful DOM. `ResumeDocumentContent` is shared by PDF export, version snapshots, and measurement so their layout is based on the same renderer.

Primary files:

- `src/components/features/resume-editor/PrintDocument.tsx`
- `src/components/features/resume-editor/ResumeMeasurementDocument.tsx`
- `src/components/features/resume-editor/useResumeMeasurement.ts`
- `src/components/features/resume-editor/ResumePreview.tsx`
- `src/components/features/resume-editor/ResumeEditor.tsx`

Important invariant: do not reintroduce page-height measurement from the editable preview. Pagination should continue to use `.resume-print-document` rendered by `ResumeMeasurementDocument`.

### Version history viewer

The snapshot viewer was simplified and now scales the resume page to the available dialog width. The dialog has bounded dimensions and internal scrolling, so content should no longer be clipped horizontally at desktop or narrow viewport sizes.

Primary files:

- `src/components/features/resume-editor/SnapshotViewer.tsx`
- `src/components/features/resume-editor/VersionHistoryDialog.tsx`
- `src/components/features/resume-editor/PrintDocument.tsx`

Snapshots remain read-only and immutable; restore/compare behavior was not changed.

## Resume content workflow

Resume content is library-first:

1. Create and fill reusable content in `/resume-blocks`.
2. Add that content to a resume.
3. The resume editor can also initiate adding content back through the resume-block workflow where supported.

Do not silently create fake resume content or bypass the existing block/library data model when improving this flow.

## Verification completed

The following passed after the implementation:

```bash
npm run lint
npm run build
npm test
```

Manual browser regression was also completed in light and dark themes, desktop and narrow layouts:

- Dashboard shell/sidebar navigation and collapse behavior
- Applications table and stats layout
- Shared date picker opening and selection
- Resume editor controls and skills layout
- Version History snapshot fit
- Page simulation versus exported PDF

The representative resume showed `1 page · target 1 page`, matching its one-page PDF export.

## Suggested regression checklist

After future changes, verify:

1. Create/edit an application and select its applied month.
2. Create an event and confirm date selection and saving still work.
3. Add education, experience, project, and skill blocks in `/resume-blocks`.
4. Add those blocks to a resume and reorder/edit bullets.
5. Confirm simulated page count matches the exported PDF.
6. Open Version History, view several snapshots, compare, and restore one.
7. Repeat the key screens at a narrow viewport and in dark mode.
8. Run lint, build, and the unit test suite.

## Known boundaries and follow-up opportunities

- The resume editor and PDF renderer share content markup, but CSS changes can still affect pagination. Any print-style change should be checked against a real PDF export.
- Version History was visually corrected; a focused Playwright regression around scaling and overflow would protect it from future changes.
- The resume-block-to-resume journey is functional but remains multi-step. A future improvement could make the handoff between the library and a selected resume more explicit without changing the underlying library-first model.
- Continue the taste-review approach in `TASTE.md`: remove unnecessary borders, cards, icons, badges, and decorative controls before adding new visual layers.

## Local files intentionally excluded from Git

These were development-tool state or screenshots and were not committed:

- `.claude/`
- `.mcp.json`
- `.playwright-mcp/`
- `dashboard-desktop.png`
- `dashboard-login-required.png`
- `dashboard-mobile.png`
- `resume-skills-fixed.png`

They should not be added unless the repository owner explicitly decides they belong in source control.
