# Internship Tracker design language

## Product character

This is a focused personal workspace for managing an internship search. It should feel calm, compact, dependable, and work-oriented rather than promotional.

## Foundations

- Use a neutral stone/ink palette with one restrained blue accent.
- Let typography, spacing, and a small number of dividers create hierarchy.
- Use 12–14px text for dense controls and supporting information; reserve larger type for page titles and primary metrics.
- Use modest radii. Controls may be rounded, but large surfaces should not look pillowy.
- Use shadows sparingly and only to clarify overlay depth.
- Support both light and dark themes with equivalent contrast and hierarchy.

## Layout

- The desktop sidebar is collapsible and persistent. The mobile sidebar is an overlay.
- Content uses a readable maximum width while allowing data tables to use available space.
- Dashboard order: page heading, four compact metrics, applications table, upcoming events.
- Keep row height compact enough to scan many applications without feeling cramped.

## Components

- Navigation has one obvious active state and quiet hover states.
- Applications live in one continuous table surface; avoid a separate card for every row.
- Status uses a small dot and text or a restrained badge, with color as a secondary cue.
- Row actions are contextual and aligned at the right edge.
- Metrics are exactly Applications, Online Assessments, Interviews, and Offers, derived from real data.
