<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Product workflow

- Read `DESIGN.md` and `TASTE.md` before changing product UI.
- Inspect the current route, components, and data flow before editing.
- Work one surface at a time: shell, applications table, overview metrics, then taste review.
- Reuse existing components and tokens where possible.
- Preserve routes, Supabase behavior, data contracts, and business logic unless the task explicitly changes them.
- Validate responsive states, light/dark themes, keyboard focus, and the production build.
