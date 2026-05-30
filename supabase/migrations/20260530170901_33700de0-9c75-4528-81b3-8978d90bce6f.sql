-- Per-profile encrypted session blob, synced across devices.
CREATE TABLE public.profile_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id text NOT NULL,
  encrypted_blob bytea NOT NULL,
  blob_iv bytea NOT NULL,
  device_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, profile_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_sessions TO authenticated;
GRANT ALL ON public.profile_sessions TO service_role;

ALTER TABLE public.profile_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own sessions"
  ON public.profile_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sessions"
  ON public.profile_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sessions"
  ON public.profile_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own sessions"
  ON public.profile_sessions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profile_sessions_set_updated_at
  BEFORE UPDATE ON public.profile_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX profile_sessions_user_id_idx ON public.profile_sessions (user_id);