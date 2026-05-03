-- ══════════════════════════════════════════════════════════════
--  IAMS Release 2.0 — Complete Database Schema
--  Run in: Supabase Dashboard → SQL Editor → New Query → Run
--  University of Botswana · CSI341
-- ══════════════════════════════════════════════════════════════

-- ── 1. Add rejection_reason to placements ────────────────────
ALTER TABLE public.placements
  ADD COLUMN IF NOT EXISTS rejection_reason text DEFAULT '';

-- ── 2. Notifications ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text        NOT NULL,
  message    text        NOT NULL DEFAULT '',
  type       text        NOT NULL DEFAULT 'info',
  is_read    boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 3. Activity log ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_log (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text,
  action     text        NOT NULL,
  details    text        DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 4. Logbooks — now with PDF support ───────────────────────
CREATE TABLE IF NOT EXISTS public.logbooks (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id          uuid        REFERENCES public.students(id) ON DELETE CASCADE,
  week_number         integer     NOT NULL,
  activities          text        NOT NULL DEFAULT '',
  challenges          text        DEFAULT '',
  skills_learned      text        DEFAULT '',
  supervisor_comments text        DEFAULT '',
  pdf_url             text        DEFAULT NULL,   -- public URL of uploaded PDF
  pdf_name            text        DEFAULT NULL,   -- original filename for display
  status              text        NOT NULL DEFAULT 'submitted',  -- submitted | reviewed
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, week_number)
);

-- Add PDF columns to existing logbooks table if it already exists
ALTER TABLE public.logbooks ADD COLUMN IF NOT EXISTS pdf_url  text DEFAULT NULL;
ALTER TABLE public.logbooks ADD COLUMN IF NOT EXISTS pdf_name text DEFAULT NULL;

-- ── 5. Supervisor reports ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supervisor_reports (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id          uuid        REFERENCES public.students(id) ON DELETE CASCADE,
  org_id              uuid        REFERENCES public.organizations(id) ON DELETE CASCADE,
  period              text        DEFAULT '',
  technical_score     integer     CHECK (technical_score BETWEEN 1 AND 10),
  ethic_score         integer     CHECK (ethic_score BETWEEN 1 AND 10),
  communication_score integer     CHECK (communication_score BETWEEN 1 AND 10),
  comments            text        DEFAULT '',
  recommendation      text        DEFAULT '',
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ── 6. University assessments ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.university_assessments (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id     uuid        REFERENCES public.students(id) ON DELETE CASCADE,
  coordinator_id uuid        REFERENCES public.coordinators(id) ON DELETE CASCADE,
  visit_number   integer     DEFAULT 1,
  visit_date     date,
  score          numeric(5,2),
  comments       text        DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ── 7. Final reports ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.final_reports (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid        REFERENCES public.students(id) ON DELETE CASCADE,
  file_url   text        NOT NULL,
  file_name  text        DEFAULT '',
  comments   text        DEFAULT '',
  grade      text        DEFAULT '',
  status     text        NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 8. Password reset requests (no-email DB-based flow) ───────
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email          text        NOT NULL UNIQUE,
  new_password   text        NOT NULL,
  status         text        NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  requested_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at    timestamptz DEFAULT NULL
);

-- ── 9. Supabase Storage bucket for logbook PDFs ───────────────
-- Run this separately in the Supabase Storage tab if it does not exist:
-- Bucket name: user-assets
-- Public: YES (so PDFs can be downloaded directly by URL)
-- Or create via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-assets', 'user-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to user-assets
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES
  ('Authenticated upload', 'user-assets', 'INSERT', '(auth.role() = ''authenticated'')'),
  ('Public read',          'user-assets', 'SELECT', 'true')
ON CONFLICT DO NOTHING;

-- ── 10. Enable Row Level Security ────────────────────────────
ALTER TABLE public.notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logbooks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisor_reports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_assessments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.final_reports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- ── 11. RLS Policies ──────────────────────────────────────────

-- Notifications: own rows only
DROP POLICY IF EXISTS "own_notifications" ON public.notifications;
CREATE POLICY "own_notifications" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);

-- Activity log: own rows only
DROP POLICY IF EXISTS "own_activity" ON public.activity_log;
CREATE POLICY "own_activity" ON public.activity_log
  FOR ALL USING (auth.uid() = user_id);

-- Logbooks: students manage own; coordinators + orgs (supervisors) read all
DROP POLICY IF EXISTS "logbooks_access" ON public.logbooks;
CREATE POLICY "logbooks_access" ON public.logbooks
  FOR ALL USING (
    -- Student who owns this logbook
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    -- Coordinator can see everything
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'coordinator')
    -- Organization (supervisor) can see logbooks of their allocated students
    OR student_id IN (
      SELECT p.student_id FROM public.placements p
      INNER JOIN public.organizations o ON o.id = p.org_id
      WHERE o.user_id = auth.uid()
    )
  );

-- Supervisor reports: org writes own, students + coord read
DROP POLICY IF EXISTS "supervisor_reports_access" ON public.supervisor_reports;
CREATE POLICY "supervisor_reports_access" ON public.supervisor_reports
  FOR ALL USING (
    org_id    IN (SELECT id FROM public.organizations WHERE user_id = auth.uid())
    OR student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'coordinator')
  );

-- University assessments: coordinators full; students read own
DROP POLICY IF EXISTS "assessments_access" ON public.university_assessments;
CREATE POLICY "assessments_access" ON public.university_assessments
  FOR ALL USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'coordinator')
  );

-- Final reports: students manage own; coordinators read all
DROP POLICY IF EXISTS "final_reports_access" ON public.final_reports;
CREATE POLICY "final_reports_access" ON public.final_reports
  FOR ALL USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'coordinator')
  );

-- Password reset requests: anyone can insert (they are unauthenticated)
-- Coordinators read and manage them
DROP POLICY IF EXISTS "reset_requests_insert" ON public.password_reset_requests;
CREATE POLICY "reset_requests_insert" ON public.password_reset_requests
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "reset_requests_coord" ON public.password_reset_requests;
CREATE POLICY "reset_requests_coord" ON public.password_reset_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'coordinator')
  );

DROP POLICY IF EXISTS "reset_requests_update" ON public.password_reset_requests;
CREATE POLICY "reset_requests_update" ON public.password_reset_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'coordinator')
  );

-- ── 12. Verification ──────────────────────────────────────────
SELECT table_name,
       (SELECT count(*) FROM information_schema.columns
        WHERE table_name = t.table_name AND table_schema = 'public') AS col_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN (
    'notifications','activity_log','logbooks',
    'supervisor_reports','university_assessments',
    'final_reports','password_reset_requests','placements'
  )
ORDER BY table_name;
