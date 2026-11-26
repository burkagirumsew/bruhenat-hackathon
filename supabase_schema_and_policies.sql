-- ==============================================================================
-- BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
-- Supabase PostgreSQL Schema & Row Level Security (RLS) Setup
-- Copy and run this script in your Supabase Project -> SQL Editor
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Registrations Table
CREATE TABLE IF NOT EXISTS public.registrations (
    id VARCHAR(64) PRIMARY KEY,
    reference_code VARCHAR(32) NOT NULL UNIQUE,
    pathway VARCHAR(16) NOT NULL, -- 'INDIVIDUAL' or 'TEAM'
    status VARCHAR(32) NOT NULL DEFAULT 'CONFIRMED',
    team_idea TEXT,
    submitted_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. Teams Table
CREATE TABLE IF NOT EXISTS public.teams (
    id VARCHAR(64) PRIMARY KEY,
    registration_id VARCHAR(64) NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
    team_name VARCHAR(128) NOT NULL,
    selected_track VARCHAR(128) NOT NULL,
    team_leader_id VARCHAR(64),
    member_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 4. Attendees Table
CREATE TABLE IF NOT EXISTS public.attendees (
    id VARCHAR(64) PRIMARY KEY,
    registration_id VARCHAR(64) NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
    team_id VARCHAR(64) REFERENCES public.teams(id) ON DELETE SET NULL,
    full_name VARCHAR(128) NOT NULL,
    email VARCHAR(128) NOT NULL,
    phone VARCHAR(32),
    gender VARCHAR(16) DEFAULT 'Female',
    city VARCHAR(64) DEFAULT 'Addis Ababa',
    discipline VARCHAR(64) NOT NULL,
    experience_level VARCHAR(32),
    preferred_track VARCHAR(128),
    skills TEXT,
    is_team_leader BOOLEAN NOT NULL DEFAULT FALSE,
    matching_consent BOOLEAN NOT NULL DEFAULT TRUE,
    eligibility_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
    safety_pledge_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    check_in_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 5. Tickets Table
CREATE TABLE IF NOT EXISTS public.tickets (
    id VARCHAR(64) PRIMARY KEY,
    attendee_id VARCHAR(64) NOT NULL UNIQUE REFERENCES public.attendees(id) ON DELETE CASCADE,
    registration_id VARCHAR(64) NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
    team_id VARCHAR(64) REFERENCES public.teams(id) ON DELETE SET NULL,
    ticket_code VARCHAR(32) NOT NULL UNIQUE,
    ticket_token_hash VARCHAR(128),
    qr_data TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    generated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMP WITHOUT TIME ZONE,
    revoked_reason TEXT
);

-- 6. Attendance Table
CREATE TABLE IF NOT EXISTS public.attendance (
    id VARCHAR(64) PRIMARY KEY,
    attendee_id VARCHAR(64) NOT NULL REFERENCES public.attendees(id) ON DELETE CASCADE,
    ticket_id VARCHAR(64) REFERENCES public.tickets(id) ON DELETE SET NULL,
    event_session_id VARCHAR(64) NOT NULL DEFAULT 'day1_kickoff',
    check_in_method VARCHAR(32) NOT NULL DEFAULT 'QR_SCAN',
    checked_in_by VARCHAR(64),
    checked_in_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- 7. Admins Table
CREATE TABLE IF NOT EXISTS public.admins (
    id VARCHAR(64) PRIMARY KEY,
    full_name VARCHAR(128) NOT NULL,
    email VARCHAR(128) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'SUPER_ADMIN',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- Insert Default Admin (Password: AdminPassword2026!)
INSERT INTO public.admins (id, full_name, email, password_hash, role, is_active)
VALUES (
    'adm_lead_2026',
    'Platform Administrator',
    'admin@bruhenat-hackathon.org',
    '$2a$12$1GxG2s5eXg4g9ZpI7A8SyejC94v.8h0rWf48j1j1qZk4pL2n6qI2m',
    'SUPER_ADMIN',
    true
) ON CONFLICT (email) DO NOTHING;

-- ==============================================================================
-- POSTGRESQL PRIVILEGES FOR ANON & AUTHENTICATED ROLES
-- Essential so PostgREST allows the anon/publishable key to access public tables
-- ==============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Allows the static frontend & admin panel to read & write without server dependencies
-- ==============================================================================

ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Allow Public (anon) to submit applications (INSERT)
DROP POLICY IF EXISTS "Public insert registrations" ON public.registrations;
CREATE POLICY "Public insert registrations" ON public.registrations FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public insert teams" ON public.teams;
CREATE POLICY "Public insert teams" ON public.teams FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public insert attendees" ON public.attendees;
CREATE POLICY "Public insert attendees" ON public.attendees FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Allow Public (anon) to view reference codes and tickets (SELECT)
DROP POLICY IF EXISTS "Public select registrations" ON public.registrations;
CREATE POLICY "Public select registrations" ON public.registrations FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public select attendees" ON public.attendees;
CREATE POLICY "Public select attendees" ON public.attendees FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public select teams" ON public.teams;
CREATE POLICY "Public select teams" ON public.teams FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public select tickets" ON public.tickets;
CREATE POLICY "Public select tickets" ON public.tickets FOR SELECT TO anon, authenticated USING (true);

-- Allow Check-in desk to record and inspect attendance
DROP POLICY IF EXISTS "Public insert attendance" ON public.attendance;
CREATE POLICY "Public insert attendance" ON public.attendance FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public select attendance" ON public.attendance;
CREATE POLICY "Public select attendance" ON public.attendance FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public select admins" ON public.admins;
CREATE POLICY "Public select admins" ON public.admins FOR SELECT TO anon, authenticated USING (true);

-- 9. Schema Upgrades & Migrations
ALTER TABLE IF EXISTS public.attendees ADD COLUMN IF NOT EXISTS gender VARCHAR(16) DEFAULT 'Female';
NOTIFY pgrst, 'reload schema';
