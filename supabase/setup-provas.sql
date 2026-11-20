-- Provas marcadas pelos alunos na Minha Física, vistas na aba "Provas / Aulão" da Gestão.
-- Somente acrescenta uma tabela nova. Nenhuma tabela existente é alterada.
-- Acesso: apenas a função exam-marks (service_role). Navegadores não leem nem escrevem direto.
BEGIN;

CREATE TABLE public.portal_exam_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code text NOT NULL CHECK (course_code ~ '^[A-Z]{2,4}[0-9]{3,4}$'),
  course_title text CHECK (course_title IS NULL OR char_length(course_title) <= 220),
  professor text NOT NULL CHECK (char_length(professor) BETWEEN 1 AND 220),
  exam_kind text NOT NULL CHECK (exam_kind IN ('P1','P2','P3','exame','trabalho','outra')),
  exam_date date NOT NULL,
  semester text NOT NULL DEFAULT '' CHECK (char_length(semester) <= 40),
  hidden boolean NOT NULL DEFAULT false,
  client_key text NOT NULL,
  ip_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portal_exam_marks_one_per_device UNIQUE (client_key, course_code, professor, exam_kind, semester)
);

CREATE INDEX portal_exam_marks_course_idx ON public.portal_exam_marks (course_code, professor, exam_date);
CREATE INDEX portal_exam_marks_date_idx ON public.portal_exam_marks (exam_date);
CREATE INDEX portal_exam_marks_ip_idx ON public.portal_exam_marks (ip_key, updated_at);
CREATE INDEX portal_exam_marks_device_idx ON public.portal_exam_marks (client_key, updated_at);

ALTER TABLE public.portal_exam_marks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portal_exam_marks FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.portal_exam_marks TO service_role;
-- Intencionalmente sem policies para anon/authenticated.

COMMIT;
