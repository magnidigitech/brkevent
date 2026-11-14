-- ============================================================================
-- Bhashyam Ramakrishna Event Invitation & Entry Management System
-- Schema Migration and 76-Ward Seed
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (Linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'scanner')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Wards table (1 to 76)
CREATE TABLE IF NOT EXISTS public.wards (
    id SERIAL PRIMARY KEY,
    ward_number INT NOT NULL UNIQUE CHECK (ward_number >= 1 AND ward_number <= 76),
    candidate_name TEXT NOT NULL,
    party TEXT NOT NULL CHECK (party IN ('TDP', 'JSP', 'BJP')),
    allowance INT NOT NULL DEFAULT 5 CHECK (allowance = 5),
    phone TEXT NULL,
    expected_veg INT NULL CHECK (expected_veg IS NULL OR expected_veg >= 0),
    expected_non_veg INT NULL CHECK (expected_non_veg IS NULL OR expected_non_veg >= 0),
    food_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    admin_notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Ward Guests table (optional up to 4 accompanying guests per ward)
CREATE TABLE IF NOT EXISTS public.ward_guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ward_id INT NOT NULL REFERENCES public.wards(id) ON DELETE CASCADE,
    guest_number INT NOT NULL CHECK (guest_number >= 1 AND guest_number <= 4),
    guest_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(ward_id, guest_number)
);

-- Arrival Batches table
CREATE TABLE IF NOT EXISTS public.arrival_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ward_id INT NOT NULL REFERENCES public.wards(id) ON DELETE RESTRICT,
    batch_size INT NOT NULL CHECK (batch_size > 0),
    request_id UUID NOT NULL UNIQUE,
    recorded_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    is_voided BOOLEAN NOT NULL DEFAULT FALSE,
    voided_at TIMESTAMPTZ NULL,
    voided_by UUID NULL REFERENCES auth.users(id),
    void_reason TEXT NULL,
    excess_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    excess_count INT NOT NULL DEFAULT 0 CHECK (excess_count >= 0),
    excess_acknowledged_by UUID NULL REFERENCES auth.users(id),
    excess_acknowledged_at TIMESTAMPTZ NULL
);

-- Audit Logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL,
    performed_by UUID NOT NULL REFERENCES auth.users(id),
    old_data JSONB NULL,
    new_data JSONB NULL,
    reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes for high-performance scanning and dashboard queries
CREATE INDEX IF NOT EXISTS idx_wards_ward_number ON public.wards(ward_number);
CREATE INDEX IF NOT EXISTS idx_arrival_batches_ward_id ON public.arrival_batches(ward_id);
CREATE INDEX IF NOT EXISTS idx_arrival_batches_is_voided ON public.arrival_batches(is_voided);
CREATE INDEX IF NOT EXISTS idx_arrival_batches_request_id ON public.arrival_batches(request_id);
CREATE INDEX IF NOT EXISTS idx_ward_guests_ward_id ON public.ward_guests(ward_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON public.audit_logs(record_id);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ward_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arrival_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper security functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS 80213
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
80213;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS 80213
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'scanner')
  );
80213;

-- RLS: profiles
DROP POLICY IF EXISTS profiles_read_policy ON public.profiles;
CREATE POLICY profiles_read_policy ON public.profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS profiles_write_policy ON public.profiles;
CREATE POLICY profiles_write_policy ON public.profiles
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- RLS: wards
DROP POLICY IF EXISTS wards_read_policy ON public.wards;
CREATE POLICY wards_read_policy ON public.wards
    FOR SELECT TO authenticated
    USING (public.is_staff());

DROP POLICY IF EXISTS wards_update_policy ON public.wards;
CREATE POLICY wards_update_policy ON public.wards
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- RLS: ward_guests
DROP POLICY IF EXISTS ward_guests_read_policy ON public.ward_guests;
CREATE POLICY ward_guests_read_policy ON public.ward_guests
    FOR SELECT TO authenticated
    USING (public.is_staff());

DROP POLICY IF EXISTS ward_guests_modify_policy ON public.ward_guests;
CREATE POLICY ward_guests_modify_policy ON public.ward_guests
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- RLS: arrival_batches
DROP POLICY IF EXISTS arrival_batches_read_policy ON public.arrival_batches;
CREATE POLICY arrival_batches_read_policy ON public.arrival_batches
    FOR SELECT TO authenticated
    USING (public.is_staff());

-- RLS: audit_logs
DROP POLICY IF EXISTS audit_logs_read_policy ON public.audit_logs;
CREATE POLICY audit_logs_read_policy ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.is_admin());

-- Function: record_arrival (Atomic, Transactional, Idempotent)
CREATE OR REPLACE FUNCTION public.record_arrival(
    p_ward_id INT,
    p_batch_size INT,
    p_request_id UUID,
    p_expected_prior_count INT DEFAULT NULL,
    p_acknowledge_excess BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS 80213
DECLARE
    v_user_id UUID := auth.uid();
    v_ward RECORD;
    v_current_entered INT := 0;
    v_proposed_total INT := 0;
    v_excess_by INT := 0;
    v_existing_batch RECORD;
    v_new_batch_id UUID;
BEGIN
    -- Ensure user is authenticated staff
    IF v_user_id IS NULL OR NOT public.is_staff() THEN
        RAISE EXCEPTION 'Unauthorized: only staff can record arrivals.';
    END IF;

    IF p_batch_size <= 0 THEN
        RAISE EXCEPTION 'Batch size must be a positive whole number.';
    END IF;

    -- Check idempotency: if request_id was already processed, return existing record
    SELECT * INTO v_existing_batch
    FROM public.arrival_batches
    WHERE request_id = p_request_id;

    IF FOUND THEN
        SELECT COALESCE(SUM(batch_size), 0) INTO v_current_entered
        FROM public.arrival_batches
        WHERE ward_id = v_existing_batch.ward_id AND is_voided = FALSE;

        RETURN jsonb_build_object(
            'success', TRUE,
            'duplicate_request', TRUE,
            'batch_id', v_existing_batch.id,
            'ward_id', v_existing_batch.ward_id,
            'batch_size', v_existing_batch.batch_size,
            'cumulative_entered', v_current_entered,
            'message', 'Request was already recorded previously.'
        );
    END IF;

    -- Lock the ward row for atomic calculation
    SELECT id, ward_number, candidate_name, allowance
    INTO v_ward
    FROM public.wards
    WHERE id = p_ward_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ward not found with id %', p_ward_id;
    END IF;

    -- Calculate current active attendance
    SELECT COALESCE(SUM(batch_size), 0) INTO v_current_entered
    FROM public.arrival_batches
    WHERE ward_id = p_ward_id AND is_voided = FALSE;

    v_proposed_total := v_current_entered + p_batch_size;

    -- Concurrency check: if staff submitted based on stale data
    IF p_expected_prior_count IS NOT NULL AND v_current_entered != p_expected_prior_count THEN
        -- If it would exceed allowance with the new reality, force renewed review
        IF v_proposed_total > v_ward.allowance THEN
            v_excess_by := v_proposed_total - v_ward.allowance;
            RETURN jsonb_build_object(
                'success', FALSE,
                'concurrency_mismatch', TRUE,
                'current_entered', v_current_entered,
                'proposed_total', v_proposed_total,
                'allowance', v_ward.allowance,
                'excess_by', v_excess_by,
                'message', 'Attendance was updated by another staff member. Please review the updated total and confirm.'
            );
        END IF;
    END IF;

    -- Excess allowance verification
    IF v_proposed_total > v_ward.allowance THEN
        v_excess_by := v_proposed_total - v_ward.allowance;
        IF NOT p_acknowledge_excess THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'excess_warning_needed', TRUE,
                'current_entered', v_current_entered,
                'proposed_total', v_proposed_total,
                'allowance', v_ward.allowance,
                'excess_by', v_excess_by,
                'message', format('This invitation allows %s people including the principal invitee. This entry will bring attendance to %s, exceeding the allowance by %s.', v_ward.allowance, v_proposed_total, v_excess_by)
            );
        END IF;
    END IF;

    -- Insert new arrival batch
    INSERT INTO public.arrival_batches (
        ward_id,
        batch_size,
        request_id,
        recorded_by,
        excess_acknowledged,
        excess_count,
        excess_acknowledged_by,
        excess_acknowledged_at
    ) VALUES (
        p_ward_id,
        p_batch_size,
        p_request_id,
        v_user_id,
        p_acknowledge_excess,
        v_excess_by,
        CASE WHEN p_acknowledge_excess THEN v_user_id ELSE NULL END,
        CASE WHEN p_acknowledge_excess THEN timezone('utc', now()) ELSE NULL END
    ) RETURNING id INTO v_new_batch_id;

    -- Log entry in audit logs
    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        action,
        performed_by,
        new_data,
        reason
    ) VALUES (
        'arrival_batches',
        v_new_batch_id::TEXT,
        'INSERT',
        v_user_id,
        jsonb_build_object(
            'ward_id', p_ward_id,
            'batch_size', p_batch_size,
            'prior_entered', v_current_entered,
            'new_total', v_proposed_total,
            'excess_acknowledged', p_acknowledge_excess,
            'excess_count', v_excess_by
        ),
        'Arrival recorded'
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'duplicate_request', FALSE,
        'batch_id', v_new_batch_id,
        'ward_id', p_ward_id,
        'batch_size', p_batch_size,
        'prior_entered', v_current_entered,
        'cumulative_entered', v_proposed_total,
        'allowance', v_ward.allowance,
        'excess_by', v_excess_by,
        'message', 'Arrival recorded successfully.'
    );
END;
80213;

-- Function: void_arrival_batch (Admin-only voiding with reason and audit log)
CREATE OR REPLACE FUNCTION public.void_arrival_batch(
    p_batch_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS 80213
DECLARE
    v_user_id UUID := auth.uid();
    v_batch RECORD;
    v_ward_id INT;
    v_new_total INT;
BEGIN
    -- Ensure caller is admin
    IF v_user_id IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: only admins can void arrival records.';
    END IF;

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RAISE EXCEPTION 'A reason must be provided to void an arrival batch.';
    END IF;

    -- Lock the batch row
    SELECT * INTO v_batch
    FROM public.arrival_batches
    WHERE id = p_batch_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Arrival batch not found.';
    END IF;

    IF v_batch.is_voided THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'Batch was already voided previously.'
        );
    END IF;

    v_ward_id := v_batch.ward_id;

    -- Update batch as voided
    UPDATE public.arrival_batches
    SET is_voided = TRUE,
        voided_at = timezone('utc', now()),
        voided_by = v_user_id,
        void_reason = p_reason
    WHERE id = p_batch_id;

    -- Calculate updated attendance
    SELECT COALESCE(SUM(batch_size), 0) INTO v_new_total
    FROM public.arrival_batches
    WHERE ward_id = v_ward_id AND is_voided = FALSE;

    -- Log to audit table
    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        action,
        performed_by,
        old_data,
        new_data,
        reason
    ) VALUES (
        'arrival_batches',
        p_batch_id::TEXT,
        'VOID',
        v_user_id,
        jsonb_build_object('is_voided', FALSE, 'batch_size', v_batch.batch_size),
        jsonb_build_object('is_voided', TRUE, 'void_reason', p_reason),
        p_reason
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'batch_id', p_batch_id,
        'ward_id', v_ward_id,
        'new_total', v_new_total,
        'message', 'Arrival batch voided successfully.'
    );
END;
80213;

-- Seed Data: Insert all 76 Wards
INSERT INTO public.wards (ward_number, candidate_name, party, allowance)
VALUES
(1, 'Kota Pitchi Reddy', 'TDP', 5),
(2, 'Shaik Shahena', 'TDP', 5),
(3, 'Shaik Shabana', 'TDP', 5),
(4, 'Ila Anitha', 'TDP', 5),
(5, 'Yadla Lakshmi', 'JSP', 5),
(6, 'Irri Sri Sai Varma', 'JSP', 5),
(7, 'Abdul Salam', 'TDP', 5),
(8, 'Chilaka Jhansi Rani', 'TDP', 5),
(9, 'Pothuraju Samatha', 'TDP', 5),
(10, 'Sanakkayala Uma Shankar', 'BJP', 5),
(11, 'Mohammed Abul Faiz', 'TDP', 5),
(12, 'Mohammadh Mavaiz', 'TDP', 5),
(13, 'Galli Satish Babu', 'TDP', 5),
(14, 'Yellavula Soujanya', 'TDP', 5),
(15, 'SM Muzaharuddin', 'TDP', 5),
(16, 'Syed Asiya Shaheda', 'TDP', 5),
(17, 'Shaik Naimuddin', 'TDP', 5),
(18, 'Dadi Jyothi', 'JSP', 5),
(19, 'Dasari Lakshmi Durga', 'JSP', 5),
(20, 'Saraswathi Venkata Srinivasa Raju', 'TDP', 5),
(21, 'Palaparthi Sai Vanaja', 'TDP', 5),
(22, 'Sankuru Srinivas', 'JSP', 5),
(23, 'Bathula Prasad', 'TDP', 5),
(24, 'Kavati Vikram Naidu', 'BJP', 5),
(25, 'Kunchapu Tripura Vasavi', 'TDP', 5),
(26, 'Shaik Shajahan', 'TDP', 5),
(27, 'Vulli Gopala Krishna', 'TDP', 5),
(28, 'Dontha Hymavathi', 'JSP', 5),
(29, 'Shaik Sharmila', 'TDP', 5),
(30, 'Alla Sirisha', 'JSP', 5),
(31, 'Ganta Venkata Moulika', 'TDP', 5),
(32, 'Tummala Nagamalleswari', 'TDP', 5),
(33, 'Bonaboina Sujatha', 'JSP', 5),
(34, 'Galam Venkateswarlu', 'TDP', 5),
(35, 'Thadisetty Amala', 'TDP', 5),
(36, 'Dasari Anil Kumar', 'TDP', 5),
(37, 'Shaik Lal Ahmad', 'JSP', 5),
(38, 'Sanjeevarao Paruchuri', 'TDP', 5),
(39, 'Pasupuleti Narasimha rao', 'JSP', 5),
(40, 'Chennam Venkata Seetayya', 'TDP', 5),
(41, 'Behara Gayathri', 'BJP', 5),
(42, 'Tadisetty Venkata Uttej', 'TDP', 5),
(43, 'Rangavajjula Gyathri', 'BJP', 5),
(44, 'Gurram Prasad', 'TDP', 5),
(45, 'Muttineni Rajesh', 'TDP', 5),
(46, 'Jampani Naga Malleswari', 'TDP', 5),
(47, 'Shama Patan', 'TDP', 5),
(48, 'Manam Srinivas', 'TDP', 5),
(49, 'Baligi Suguna Devi', 'TDP', 5),
(50, 'Nulupuri Srinivasarao', 'TDP', 5),
(51, 'Nagineni Murali Krishna', 'JSP', 5),
(52, 'Panchumarthi Nagamani', 'TDP', 5),
(53, 'Varalakshmi Singamsetty', 'TDP', 5),
(54, 'Pakalapati Srikanth', 'TDP', 5),
(55, 'Gunda Bhavani', 'TDP', 5),
(56, 'Vemulapalli Sriram Prasad', 'TDP', 5),
(57, 'Kommineni Koteswara Rao', 'TDP', 5),
(58, 'Mattipudi Siva Lakshmi', 'JSP', 5),
(59, 'Srinuvasrao Peram', 'TDP', 5),
(60, 'Eluka Dhanalakshmi', 'TDP', 5),
(61, 'Bezzan Anil', 'TDP', 5),
(62, 'Nukavarapu Balaji', 'TDP', 5),
(63, 'Bettam Sowri', 'TDP', 5),
(64, 'Yerramsetti Rajesh', 'JSP', 5),
(65, 'Yerramsetti Sandhya', 'TDP', 5),
(66, 'Talla Sambasiva Rao(Bujji)', 'TDP', 5),
(67, 'Konduri Samatha', 'JSP', 5),
(68, 'Vangara Edukondalu', 'TDP', 5),
(69, 'Muppavarapu Bharathi', 'TDP', 5),
(70, 'Alladdi Jessy Krupa Sowjanya', 'TDP', 5),
(71, 'Gudimetla Dayaratnam', 'TDP', 5),
(72, 'Yerraguntla Anand', 'TDP', 5),
(73, 'Ayisetti Kanaka Durga', 'JSP', 5),
(74, 'Swathi Krishna Gudipalli', 'TDP', 5),
(75, 'Chereddy Naga Kranthi', 'TDP', 5),
(76, 'Ankam Malini', 'TDP', 5)
ON CONFLICT (ward_number) DO UPDATE
SET candidate_name = EXCLUDED.candidate_name,
    party = EXCLUDED.party,
    allowance = EXCLUDED.allowance;


-- Enable Realtime for live updates across all staff devices
DO 80227
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'wards'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.wards;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'arrival_batches'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.arrival_batches;
    END IF;
END 80227;
