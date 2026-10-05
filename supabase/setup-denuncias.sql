-- CAHK Portal: denúncias privadas. Adição independente dos módulos existentes.
BEGIN;
CREATE TABLE public.cahk_complaints (
  id uuid PRIMARY KEY,
  submission_key uuid NOT NULL UNIQUE CHECK (submission_key = id),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  sequence_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  protocol text GENERATED ALWAYS AS ('CAHK-' || sequence_number::text) STORED,
  text text NOT NULL CHECK (char_length(btrim(text)) BETWEEN 20 AND 10000),
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(attachments) = 'array' AND jsonb_array_length(attachments) <= 3),
  status text NOT NULL DEFAULT 'recebida' CHECK (status IN ('recebida','em_analise','encaminhada','encerrada')),
  internal_notes text NOT NULL DEFAULT '' CHECK (char_length(internal_notes) <= 10000),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cahk_complaints_created ON public.cahk_complaints (created_at DESC, id DESC);
CREATE INDEX cahk_complaints_status_created ON public.cahk_complaints (status, created_at DESC, id DESC);
CREATE TABLE public.cahk_complaint_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  complaint_id uuid NOT NULL REFERENCES public.cahk_complaints(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL CHECK (status IN ('recebida','em_analise','encaminhada','encerrada')),
  notes text NOT NULL CHECK (char_length(notes) <= 10000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cahk_complaint_history_record ON public.cahk_complaint_history (complaint_id, created_at DESC);
CREATE INDEX cahk_complaint_history_actor ON public.cahk_complaint_history (actor_id);
CREATE TABLE public.cahk_complaint_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL
);
ALTER TABLE public.cahk_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cahk_complaint_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cahk_complaint_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cahk_complaints, public.cahk_complaint_history, public.cahk_complaint_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.cahk_complaints, public.cahk_complaint_history, public.cahk_complaint_limits TO service_role;
REVOKE ALL ON SEQUENCE public.cahk_complaints_sequence_number_seq, public.cahk_complaint_history_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.cahk_complaints_sequence_number_seq, public.cahk_complaint_history_id_seq TO service_role;

-- No raw IP, user identity or stable origin identifier is stored here.
-- Window-bound hashes expire on the next traffic-driven cleanup, after 30 min.
CREATE FUNCTION public.cahk_complaint_take_slot(rate_key text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_window timestamptz := to_timestamp(floor(extract(epoch FROM now()) / 900) * 900);
        v_total integer; v_attempts integer;
BEGIN
  IF rate_key IS NULL OR rate_key !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;
  DELETE FROM public.cahk_complaint_limits WHERE window_start < now() - interval '30 minutes';
  INSERT INTO public.cahk_complaint_limits(key,window_start,attempts)
    VALUES ('global:' || v_window::text, v_window, 1)
    ON CONFLICT (key) DO UPDATE SET attempts = public.cahk_complaint_limits.attempts + 1
    RETURNING attempts INTO v_total;
  IF v_total > 60 THEN RETURN false; END IF;
  INSERT INTO public.cahk_complaint_limits(key,window_start,attempts) VALUES (rate_key, v_window, 1)
    ON CONFLICT (key) DO UPDATE SET attempts = public.cahk_complaint_limits.attempts + 1
    RETURNING attempts INTO v_attempts;
  RETURN v_attempts <= 3;
END;
$$;
CREATE FUNCTION public.cahk_complaint_update(p_id uuid, p_version integer, p_status text, p_notes text, p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_row public.cahk_complaints%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor AND ativo AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF p_status NOT IN ('recebida','em_analise','encaminhada','encerrada') OR p_status IS NULL OR p_notes IS NULL OR char_length(p_notes) > 10000 THEN
    RAISE EXCEPTION 'Dados inválidos';
  END IF;
  SELECT * INTO v_row FROM public.cahk_complaints WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_row.version <> p_version THEN RETURN NULL; END IF;
  UPDATE public.cahk_complaints SET status = p_status, internal_notes = p_notes,
    version = version + 1, updated_at = now() WHERE id = p_id;
  INSERT INTO public.cahk_complaint_history(complaint_id,actor_id,status,notes)
    VALUES (p_id,p_actor,p_status,p_notes);
  RETURN jsonb_build_object('saved',true,'version',v_row.version + 1);
END;
$$;
REVOKE ALL ON FUNCTION public.cahk_complaint_take_slot(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cahk_complaint_update(uuid,integer,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cahk_complaint_take_slot(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cahk_complaint_update(uuid,integer,text,text,uuid) TO service_role;

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
  VALUES ('cahk-private-complaints','cahk-private-complaints',false,2097152,ARRAY['image/jpeg']);
-- Intentionally no SELECT/INSERT/UPDATE/DELETE storage policy for browser roles.
COMMIT;
