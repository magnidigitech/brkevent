-- Helper script to provision Admin and Scanner Staff in Supabase
-- Replace passwords as desired. This can be executed directly in the Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create Vivek Admin Account (vivek@gmail.com)
DO $$
DECLARE
    new_user_id UUID := gen_random_uuid();
    user_email TEXT := 'vivek@gmail.com';
    user_password TEXT := 'SecureAdmin2026!';
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
        ON CONFLICT (id) DO UPDATE SET role = 'admin';
    ELSE
        UPDATE public.profiles
        SET role = 'admin'
        WHERE email = user_email;
    END IF;
END $$;

-- 2. Create Default Administrator (admin@bhashyamramakrishna.in)
DO $$
DECLARE
    new_user_id UUID := gen_random_uuid();
    user_email TEXT := 'admin@bhashyamramakrishna.in';
    user_password TEXT := 'SecureAdmin2026!';
    user_name TEXT := 'Event Administrator';
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
        ON CONFLICT (id) DO UPDATE SET role = 'admin';
    ELSE
        UPDATE public.profiles
        SET role = 'admin'
        WHERE email = user_email;
    END IF;
END $$;

-- 3. Create Gate Scanner Staff (scanner1@bhashyamramakrishna.in)
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
