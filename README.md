# Bhashyam Ramakrishna Event Invitation & Entry Management System

A mobile-friendly, database-backed invitation scanning and gate attendance management system built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **Supabase (PostgreSQL with RLS & Stored Procedures)**, ready for deployment on **Vercel**.

Designed to work seamlessly with existing printed QR codes pointing to `https://event.bhashyamramakrishna.in/ward1` through `https://event.bhashyamramakrishna.in/ward76`.

---

## Table of Contents
1. [Key Features](#key-features)
2. [Ward Dataset & Allowance Details](#ward-dataset--allowance-details)
3. [Existing Printed QR URL Architecture](#existing-printed-qr-url-architecture)
4. [Role-Based Access Control (Admin vs Scanner)](#role-based-access-control-admin-vs-scanner)
5. [Transactional Reliability & Concurrency](#transactional-reliability--concurrency)
6. [Local Development Setup](#local-development-setup)
7. [Supabase Setup & Migrations](#supabase-setup--migrations)
8. [Provisioning Initial Admin & Staff Accounts](#provisioning-initial-admin--staff-accounts)
9. [Vercel Deployment Instructions](#vercel-deployment-instructions)
10. [Connecting `event.bhashyamramakrishna.in` to Vercel](#connecting-eventbhashyamramakrishnain-to-vercel)
11. [Verification & Test Results](#verification--test-results)

---

## Key Features

- **Exact Printed QR URL Preservation**: Matches `/ward1` to `/ward76` directly on `event.bhashyamramakrishna.in`. No re-printing required.
- **Mobile Rear-Camera Scanner**: Mobile-optimized scanning with camera permission handling, start/stop toggle, torch support, and manual ward lookup fallback.
- **Strict QR Validation**: Accepts only official URLs on `event.bhashyamramakrishna.in` with paths `/ward1` to `/ward76`. Rejects phishing links, invalid wards, or arbitrary input.
- **Allowance & Excess Warning**:
  - Each ward has a 5-person total allowance (including the principal invitee).
  - Normal total allowance across all 76 wards is 380 people.
  - Repeating arrivals (e.g. 2 + 3 = 5) are supported without warning.
  - The 6th person triggers an explicit warning:
    > *"This invitation allows 5 people including the principal invitee. This entry will bring attendance to X, exceeding the allowance by Y."*
  - Requires explicit confirmation ("Submit anyway"), logged with staff user ID and timestamp.
- **Concurrency & Idempotency Safety**:
  - PostgreSQL row-level locks (`SELECT ... FOR UPDATE`) prevent race conditions.
  - Unique `request_id` (UUID) ensures network retries or double taps create only one record.
  - Server re-verifies allowance at time of write; if another staff recorded an arrival in the interim, requires renewed review.
- **Admin Correction & Audit Trail**:
  - Admins can void mistaken entry batches with a mandatory reason.
  - Voided batches are subtracted from totals while preserving history in `audit_logs`.
- **Food Planning & Attendance Separation**:
  - Expected food counts (Veg & Non-veg) start as `Unset`.
  - Display flags any food mismatch with the 5-person allowance without altering values.
  - Food planning and actual gate attendance are strictly decoupled.
- **Responsive Admin Dashboard**:
  - Realtime metrics: Total Entered, Capacity (380), Wards Arrived, Wards Pending, Excess Count, Expected Veg & Non-veg totals.
  - Searchable and filterable ward table.
  - Protected CSV exports (Ward Summary & Entry History) with **formula injection defense** (sanitizing `=`, `+`, `-`, `@`, `\t`, `\r`).
  - All timestamps displayed in **Asia/Kolkata (IST)** and stored in **UTC**.

---

## Ward Dataset & Allowance Details

Extracted directly from the official Guntur Municipal Corporation candidate document:
- **Total Wards**: 76 (Wards 1–76 appear exactly once)
- **Party Breakdown**:
  - **TDP**: 57 Wards
  - **JSP (Janasena)**: 15 Wards
  - **BJP**: 4 Wards
- **Per-Ward Allowance**: 5 people TOTAL (principal invitee + up to 4 guests)
- **Normal Total Capacity**: 380 people (76 × 5)

---

## Existing Printed QR URL Architecture

Existing printed invitations link to:
```
https://event.bhashyamramakrishna.in/ward1
https://event.bhashyamramakrishna.in/ward2
...
https://event.bhashyamramakrishna.in/ward76
```

- When scanned via the mobile app scanner, the URL is parsed in memory and loads the ward details dynamically without blind browser navigation.
- If a staff member opens a ward URL in their mobile browser:
  - If **logged out**, Next.js middleware and route guards redirect to `/login?returnUrl=/ward[n]` so public visitors cannot view private candidate or guest data.
  - Upon successful sign-in, the user is immediately redirected to that ward's attendance card.

---

## Role-Based Access Control (Admin vs Scanner)

| Feature | Admin | Scanner Staff | Public |
| :--- | :---: | :---: | :---: |
| Scan QR invitations & manual lookup | ✅ | ✅ | ❌ |
| Record arrival batches & acknowledge excess | ✅ | ✅ | ❌ |
| View ward attendance & previous batches | ✅ | ✅ | ❌ |
| Edit candidate name, party, phone, notes | ✅ | ❌ | ❌ |
| Edit food planning counts & confirm status | ✅ | ❌ | ❌ |
| Void mistaken arrival batches (with reason) | ✅ | ❌ | ❌ |
| View admin dashboard & audit logs | ✅ | ❌ | ❌ |
| Export CSV reports | ✅ | ❌ | ❌ |

---

## Transactional Reliability & Concurrency

Arrival submissions use the PostgreSQL stored procedure `record_arrival`:
1. **Idempotency**: Looks up `request_id`. If already inserted, returns the previous response with `duplicate_request: true`.
2. **Row Locking**: Executes `SELECT ... FROM public.wards WHERE id = p_ward_id FOR UPDATE;` to block concurrent writers until calculation completes.
3. **Stale Data Detection**: Compares `p_expected_prior_count` with actual DB total. If another gate scanner entered people concurrently, returns `concurrency_mismatch: true` and prompts staff to confirm with updated totals.
4. **Audit Trail**: Every insertion and void action writes immutable records to `public.audit_logs`.

---

## Local Development Setup

### 1. Prerequisites
- Node.js 18+ (tested on Node 20 / 22 / 25)
- npm or pnpm

### 2. Clone and Install
```bash
git clone <repo-url>
cd "BRK Event"
npm install
```

### 3. Environment Configuration
Copy the template environment file:
```bash
cp .env.example .env.local
```
Fill in your Supabase credentials (see [Supabase Setup](#supabase-setup--migrations)).

*(Note: In local development, the app also includes an in-memory fallback store with full mock support so you can test all features and UI even before connecting to a live Supabase project!)*

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Run Verification Test Suite
```bash
npm test
```

---

## Supabase Setup & Migrations

### 1. Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and create a new project.
2. Under **Project Settings > API**, copy:
   - **Project URL** -> `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** -> `SUPABASE_SERVICE_ROLE_KEY` (Keep server-side only)

### 2. Run Database Migration & 76-Ward Seed
1. In the Supabase Dashboard, open **SQL Editor**.
2. Open and paste the complete migration file:
   `supabase/migrations/20261114000000_schema_and_seed.sql`
3. Click **Run**.
   - This creates all tables (`profiles`, `wards`, `ward_guests`, `arrival_batches`, `audit_logs`).
   - Configures Row Level Security (RLS) policies.
   - Creates the stored procedures `record_arrival` and `void_arrival_batch`.
   - Seeds all 76 wards (57 TDP, 15 JSP, 4 BJP).
   - Enables Supabase Realtime publication.

---

## Provisioning Initial Admin & Staff Accounts

Public registration is disabled. Accounts are provisioned securely by the administrator:

### Method A: Via Supabase SQL Editor (Recommended)
Run the script `supabase/create_staff_user.sql`:

```sql
-- 1. Create Admin Account
DO $$
DECLARE
    new_user_id UUID := gen_random_uuid();
    user_email TEXT := 'admin@bhashyamramakrishna.in';
    user_password TEXT := 'YourStrongPassword123!';
    user_name TEXT := 'Event Administrator';
BEGIN
    INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
    ) VALUES (
        new_user_id, '00000000-0000-0000-0000-000000000000',
        user_email, crypt(user_password, gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', user_name), now(), now(),
        'authenticated', 'authenticated'
    );

    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (new_user_id, user_email, user_name, 'admin')
    ON CONFLICT (id) DO UPDATE SET role = 'admin';
END $$;
```

To create a **Scanner Staff** account, set the role to `'scanner'`.

### Method B: Via Supabase Dashboard UI
1. Go to **Authentication > Users > Add User**.
2. Enter email and password.
3. In **Table Editor > profiles**, add a row with the user's UUID and set `role` to `'admin'` or `'scanner'`.

---

## Vercel Deployment Instructions

### 1. Push to GitHub
```bash
git add .
git commit -m "Complete Bhashyam Ramakrishna Event invitation & entry management app"
git push origin main
```

### 2. Import into Vercel
1. Log in to [https://vercel.com](https://vercel.com).
2. Click **Add New... > Project** and select your repository.
3. Framework Preset: **Next.js**.

### 3. Configure Environment Variables in Vercel
Add the following in Vercel project settings:
- `NEXT_PUBLIC_SUPABASE_URL`: `https://your-project.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `<your-supabase-anon-key>`
- `SUPABASE_SERVICE_ROLE_KEY`: `<your-supabase-service-role-key>`
- `NEXT_PUBLIC_APP_URL`: `https://event.bhashyamramakrishna.in`

### 4. Deploy
Click **Deploy**. Vercel will build and output the production deployment.

---

## Connecting `event.bhashyamramakrishna.in` to Vercel

To ensure all already-printed QR codes (`https://event.bhashyamramakrishna.in/ward1` .. `ward76`) resolve directly to your Vercel deployment:

### 1. Add Domain in Vercel
1. In your Vercel Project, go to **Settings > Domains**.
2. Enter `event.bhashyamramakrishna.in` and click **Add**.

### 2. Configure DNS Records in your Domain Registrar / DNS Provider
Add a **CNAME** record in the DNS management panel for `bhashyamramakrishna.in`:

| Type | Name / Host | Value / Target | TTL |
| :--- | :--- | :--- | :--- |
| **CNAME** | `event` | `cname.vercel-dns.com` | Automatic / 300s |

*(If using Cloudflare, set Proxy status to DNS Only during initial SSL verification, or Full/Strict SSL).*

### 3. SSL Certificate
Vercel automatically provisions and renews a free Let's Encrypt SSL certificate for `event.bhashyamramakrishna.in`. Once DNS propagates (typically 1–5 minutes), the domain status turns green with a checkmark.

---

## Verification & Test Results

The automated test suite (`npm test`) executes 35 tests covering all mission-critical flows:

```
====================================================
BHASHYAM RAMAKRISHNA EVENT SYSTEM - FULL VERIFICATION
====================================================

--- TEST GROUP 1: QR Parser & URL Validation ---
✅ [PASS] All 76 printed QR URLs resolve to exact ward numbers (1–76)
✅ [PASS] Security Check: Ward 0 rejected
✅ [PASS] Security Check: Ward 77 rejected
✅ [PASS] Security Check: Ward 999 rejected
✅ [PASS] Security Check: Non-ward path rejected
✅ [PASS] Security Check: Unrelated foreign domain rejected
✅ [PASS] Security Check: Malformed input rejected
✅ [PASS] Security Check: Empty input rejected

--- TEST GROUP 2: Ward Dataset Integrity ---
✅ [PASS] Dataset contains exactly 76 wards
✅ [PASS] All wards 1–76 appear uniquely without duplicates
✅ [PASS] TDP ward count is 57 (got 57)
✅ [PASS] JSP ward count is 15 (got 15)
✅ [PASS] BJP ward count is 4 (got 4)
✅ [PASS] Combined normal allowance is 380 (got 380)

--- TEST GROUP 3: Attendance Batch Processing ---
✅ [PASS] Ward 42 initially has 0 attendance
✅ [PASS] Batch 1 (2 people): cumulative attendance = 2
✅ [PASS] Batch 2 (3 people): cumulative attendance = 5 (exact allowance)

--- TEST GROUP 4: Excess Warning & Confirmation ---
✅ [PASS] 6th person triggers excess warning (proposed 6, excess by 1) and does NOT save automatically
✅ [PASS] Confirmed excess entry saves successfully: cumulative attendance = 6

--- TEST GROUP 5: Idempotency Protection ---
✅ [PASS] Re-submitting with identical request ID is recognized as duplicate and does NOT increase count

--- TEST GROUP 6: Food Planning Separation ---
✅ [PASS] Updating food counts does not alter actual attendance (remains 6)
✅ [PASS] Food counts saved accurately (Veg: 3, Non-veg: 2, Confirmed: true)

--- TEST GROUP 7: Voiding Mistakes & Audit Logs ---
✅ [PASS] Voiding batch 3 brings attendance back to 5
✅ [PASS] Ward attendance recalculated to 5 excluding voided batch
✅ [PASS] Voided batch record is preserved in history with void reason
✅ [PASS] Audit log recorded 5 entries

--- TEST GROUP 8: CSV Formula Injection Protection ---
✅ [PASS] Sanitized formula '=1+2' to ''=1+2'
✅ [PASS] Sanitized formula '-5+10' to ''-5+10'
✅ [PASS] Sanitized formula '+CMD|' to ''+CMD|'
✅ [PASS] Sanitized formula '@SUM(A1:A10)' to ''@SUM(A1:A10)'
✅ [PASS] Safe value unchanged

--- TEST GROUP 9: Dashboard Summary Metrics ---
✅ [PASS] Dashboard normal total allowance = 380
✅ [PASS] Dashboard total entered reflects valid non-voided count (5)
✅ [PASS] Dashboard counts 1 ward with arrivals
✅ [PASS] Dashboard counts 75 wards pending

====================================================
VERIFICATION COMPLETE: 35 / 35 TESTS PASSED!
====================================================
```

### Remaining Considerations for Event Day
- **Device Lighting**: For indoor gates, ensure sufficient lighting or use the built-in torch toggle on supported devices.
- **Offline Attendance**: Attendance is never silently queued offline; if connection drops, the app preserves the unsaved input and prompts staff clearly to retry when connection restores.
- **Realtime Sync**: The dashboard uses a hybrid architecture with polling every 12 seconds alongside Supabase Realtime subscriptions, guaranteeing synchronization across all staff devices.

