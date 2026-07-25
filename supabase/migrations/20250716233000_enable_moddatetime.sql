-- _create_applications.sql (the original moddatetime setup) uses a
-- non-timestamped filename that the Supabase CLI's migration runner
-- skips locally, leaving the extensions.moddatetime() function missing
-- before 20250716233100_create_watchlist.sql needs it. This migration is
-- purely additive — it does not touch applications/events/watchlist/
-- resume-builder tables — and exists solely to unblock local migration
-- application by creating the extension earlier in timestamp order.

create schema if not exists extensions;

create extension if not exists moddatetime
with schema extensions;
