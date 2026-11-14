-- ============================================================================
-- Bhashyam Ramakrishna Event Operations - Unified Staff Account Provisioning
-- Primary User: vivek@bhashyamramakrishna.in (Admin role: Access to both Scanning & Dashboard)
-- Password: Magni@3939
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create or Update Unified Admin Account (vivek@bhashyamramakrishna.in)
DO $$
DECLARE
    new_user_id UUID := gen_random_uuid();
    user_email TEXT := 'vivek@bhashyamramakrishna.in';
    user_password TEXT := 'Magni@3939';
    user_name TEXT := 'Venkata Vivek (Admin)';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = user_email) THEN
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            role,
            aud
        ) VALUES (
            new_user_id,
            '00000000-0000-0000-0000-000000000000',
            user_email,
            crypt(user_password, gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('full_name', user_name),
            now(),
            now(),
            'authenticated',
            'authenticated'
        );

        INSERT INTO public.profiles (id, email, full_name, role)
        VALUES (new_user_id, user_email, user_name, 'admin')
        ON CONFLICT (id) DO UPDATE SET role = 'admin', email = user_email;
    ELSE
        -- Update password and role if account already exists
        UPDATE auth.users
        SET encrypted_password = crypt(user_password, gen_salt('bf')),
            updated_at = now()
        WHERE email = user_email;

        UPDATE public.profiles
        SET role = 'admin'
        WHERE email = user_email;
    END IF;
END $$;
