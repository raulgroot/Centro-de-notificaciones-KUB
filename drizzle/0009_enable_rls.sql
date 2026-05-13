-- Enable Row Level Security on all public tables flagged by Supabase's
-- linter (rls_disabled_in_public).
--
-- Context: the app accesses Supabase exclusively via the service role key
-- on the server (lib/adapters/supabase/*.ts → createClient(url,
-- serviceRoleKey)). service_role bypasses RLS, so enabling it here does
-- NOT affect server functionality. What it DOES block is direct access
-- via the anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY, which is shipped to
-- the browser). Before this migration, anyone with the public anon key
-- could read/write these tables freely.
--
-- We don't add any policies, so once RLS is on, anon/authenticated
-- requests get zero access. When/if we add a logged-in user surface
-- (HSBC read-only viewer, etc.) we'll layer SELECT policies on top.
--
-- Idempotent: ALTER TABLE ... ENABLE ROW LEVEL SECURITY is a no-op if
-- already enabled.

ALTER TABLE public.integration_links     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_notes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_runs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_cache   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flows                 ENABLE ROW LEVEL SECURITY;

-- flow_nodes / flow_edges are orphaned tables left over from the legacy
-- "flow graph" prototype (drizzle/0003_flow_graph.sql in an old worktree).
-- They are not in the current schema and no app code references them.
-- We still lock them down with RLS until they are dropped in a follow-up.
ALTER TABLE public.flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_edges ENABLE ROW LEVEL SECURITY;

-- Defense in depth: also enable RLS on every other public table even if
-- the linter didn't flag them yet (they may have RLS already; ENABLE is
-- idempotent and won't error). This guards against future drift.
ALTER TABLE public.flow_steps             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics_snapshots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_definitions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_milestones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_loads         ENABLE ROW LEVEL SECURITY;
