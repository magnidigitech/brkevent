-- Helper script to provision Admin and Scanner Staff in Supabase
-- Replace 'admin@example.com' and 'your_secure_password' with the actual staff email and password.
-- This can be executed in the Supabase SQL Editor.

-- 1. Create an Admin Account
DO $$
DECLARE
    new_user_id UUID := gen_random_uuid();
    user_email TEXT := 'admin@bhashyamramakrishna.in';
    user_password TEXT := 'SecureAdmin2026!';
    user_name TEXT := 'Event Administrator';
BEGIN
    -- Check if user already exists in auth.users
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
        ON CONFLICT (id) DO UPDATE SET role = 'admin';
    ELSE
        UPDATE public.profiles
        SET role = 'admin'
        WHERE email = user_email;
    END IF;
END $$;

-- 2. Create a Scanner Staff Account
DO $$
DECLARE
    new_user_id UUID := gen_random_uuid();
    user_email TEXT := 'scanner1@bhashyamramakrishna.in';
    user_password TEXT := 'ScannerPass2026!';
    user_name TEXT := 'Gate Scanner 1';
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
        VALUES (new_user_id, user_email, user_name, 'scanner')
        ON CONFLICT (id) DO UPDATE SET role = 'scanner';
    ELSE
        UPDATE public.profiles
        SET role = 'scanner'
        WHERE email = user_email;
    END IF;
END $$;
