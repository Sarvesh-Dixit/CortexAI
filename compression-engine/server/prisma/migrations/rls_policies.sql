-- ═════════════════════════════════════════════════════════════════════════
-- Row Level Security (RLS) — defense in depth
--
-- Apply this AFTER `prisma migrate deploy` has created all tables.
-- Run in Supabase SQL Editor or via `psql`.
--
-- Architecture:
--   • Our Node.js backend connects with the service_role key
--     → service_role BYPASSES all RLS policies. Backend is trusted.
--   • Any client hitting Supabase directly with the anon key gets ZERO rows
--     because no policies grant SELECT to `anon` or `authenticated`.
--   • This is a hard guarantee: even if backend has a bug, no user data
--     leaks to the outside world.
--
-- If you later migrate to Supabase Auth and want per-user policies,
-- see the commented "SUPABASE AUTH INTEGRATION" section at the bottom.
-- ═════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Enable RLS on every user-scoped table ──────────────────────────────
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys            ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE compressions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE compression_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_jobs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmarks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs       ENABLE ROW LEVEL SECURITY;

-- ─── Deny-by-default: no policies granted to anon or authenticated ──────
-- With RLS enabled and no policies, the anon key sees NOTHING.
-- The service_role key bypasses RLS entirely, so our backend still works.

-- ─── llm_provider_configs is READ-ONLY reference data, safe to expose ──
ALTER TABLE llm_provider_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "llm_provider_configs_read" ON llm_provider_configs
  FOR SELECT
  TO authenticated, anon
  USING (is_enabled = true);

-- ─── Revoke all default privileges from public/anon on sensitive tables ─
REVOKE ALL ON users               FROM anon, authenticated;
REVOKE ALL ON sessions            FROM anon, authenticated;
REVOKE ALL ON password_resets     FROM anon, authenticated;
REVOKE ALL ON api_keys            FROM anon, authenticated;
REVOKE ALL ON documents           FROM anon, authenticated;
REVOKE ALL ON compressions        FROM anon, authenticated;
REVOKE ALL ON compression_metrics FROM anon, authenticated;
REVOKE ALL ON ocr_jobs            FROM anon, authenticated;
REVOKE ALL ON benchmarks          FROM anon, authenticated;
REVOKE ALL ON activity_logs       FROM anon, authenticated;

-- Grant SELECT on llm_provider_configs so the app can list providers
GRANT SELECT ON llm_provider_configs TO anon, authenticated;

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════
-- OPTIONAL — SUPABASE AUTH INTEGRATION
--
-- If you later switch from custom JWT to Supabase Auth, uncomment these
-- policies. They enforce per-user isolation at the DB layer using
-- auth.uid() which Supabase populates from the incoming JWT.
--
-- To use these, your app must:
--   1. Authenticate users through Supabase Auth
--   2. Send the user's JWT as the Bearer token when querying Supabase
--   3. Store users in Supabase's auth.users table (or link via user_id)
-- ═════════════════════════════════════════════════════════════════════════

-- CREATE POLICY "Users can view own profile" ON users
--   FOR SELECT TO authenticated
--   USING (auth.uid()::text = id::text);
--
-- CREATE POLICY "Users can update own profile" ON users
--   FOR UPDATE TO authenticated
--   USING (auth.uid()::text = id::text);
--
-- CREATE POLICY "Users can access own api keys" ON api_keys
--   FOR ALL TO authenticated
--   USING (auth.uid()::text = user_id::text)
--   WITH CHECK (auth.uid()::text = user_id::text);
--
-- CREATE POLICY "Users can access own documents" ON documents
--   FOR ALL TO authenticated
--   USING (auth.uid()::text = user_id::text)
--   WITH CHECK (auth.uid()::text = user_id::text);
--
-- CREATE POLICY "Users can access own compressions" ON compressions
--   FOR ALL TO authenticated
--   USING (auth.uid()::text = user_id::text)
--   WITH CHECK (auth.uid()::text = user_id::text);
--
-- CREATE POLICY "Users can view own compression metrics" ON compression_metrics
--   FOR SELECT TO authenticated
--   USING (EXISTS (
--     SELECT 1 FROM compressions
--     WHERE compressions.id = compression_metrics.compression_id
--       AND compressions.user_id::text = auth.uid()::text
--   ));
--
-- CREATE POLICY "Users can access own ocr jobs" ON ocr_jobs
--   FOR ALL TO authenticated
--   USING (auth.uid()::text = user_id::text)
--   WITH CHECK (auth.uid()::text = user_id::text);
--
-- CREATE POLICY "Users can access own benchmarks" ON benchmarks
--   FOR ALL TO authenticated
--   USING (auth.uid()::text = user_id::text)
--   WITH CHECK (auth.uid()::text = user_id::text);
--
-- CREATE POLICY "Users can view own activity" ON activity_logs
--   FOR SELECT TO authenticated
--   USING (auth.uid()::text = user_id::text);
