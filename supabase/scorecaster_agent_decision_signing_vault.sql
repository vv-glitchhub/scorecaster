-- Scorecaster Agent decision signing Vault V1
-- Stores the dedicated signing key in Supabase Vault when a Vercel env key is not available.
-- The decrypted value is exposed only through a service-role-only RPC.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'supabase_vault'
  ) THEN
    RAISE EXCEPTION 'supabase_vault extension is required for Agent decision signing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM vault.secrets
    WHERE name = 'scorecaster.agent_decision_signing_key'
  ) THEN
    PERFORM vault.create_secret(
      encode(gen_random_bytes(48), 'hex'),
      'scorecaster.agent_decision_signing_key',
      'Dedicated server-only Scorecaster Agent decision ticket signing key',
      NULL
    );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.scorecaster_agent_decision_signing_key()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, vault
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'scorecaster.agent_decision_signing_key'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.scorecaster_agent_decision_signing_key() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.scorecaster_agent_decision_signing_key() FROM anon;
REVOKE ALL ON FUNCTION public.scorecaster_agent_decision_signing_key() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.scorecaster_agent_decision_signing_key() TO service_role;

COMMENT ON FUNCTION public.scorecaster_agent_decision_signing_key() IS
  'Service-role-only access to the dedicated Scorecaster Agent decision signing key stored in Supabase Vault.';
