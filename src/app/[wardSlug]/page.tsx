import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WardClientView } from './WardClientView';
import { validateDivisionHash } from '@/lib/utils/divisionHash';
import { getWardByNumber } from '@/lib/server/dataStore';
import { ShieldAlert, ShieldX, LogIn, ArrowLeft } from 'lucide-react';
import { WARDS_SEED_DATA } from '@/data/wardsSeed';
import WINNING_CORPORATORS from '@/data/winningCorporators.json';
import { getCandidateJpegPhotoUrls } from '@/lib/candidatePhotos';

interface PageProps {
  params: Promise<{ wardSlug: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { wardSlug } = await params;
  const cleanSlug = wardSlug.toLowerCase().trim();
  const match = cleanSlug.match(/^(?:(ward|division|vip)-?)?([0-9]+)(?:-([a-z0-9]{4}))?$/);

  const defaultTitle = 'Grand Felicitation by Shri Bhashyam Rama Krishna Garu, MP Rajyasabha';
  const defaultDesc = 'Official Digital Invitation Pass and Entry Management System.';

  if (!match) {
    return {
      title: defaultTitle,
      description: defaultDesc,
    };
  }

  const wardNumber = parseInt(match[2], 10);
  const isVip = wardNumber >= 101;
  const seedWard = WARDS_SEED_DATA.find((w) => w.ward_number === wardNumber);
  const winningCorp = WINNING_CORPORATORS.find((w) => w.ward === wardNumber);

  let candidateName = winningCorp ? winningCorp.nameEn : (seedWard?.candidate_name || (isVip ? `VIP Pass #${wardNumber}` : `Division ${wardNumber}`));
  if (isVip && !seedWard) {
    try {
      const dbWard = await getWardByNumber(wardNumber);
      if (dbWard?.candidate_name) candidateName = dbWard.candidate_name;
    } catch {}
  }

  const title = 'Grand Felicitation by Shri Bhashyam Rama Krishna Garu, MP Rajyasabha';
  const description = isVip
    ? `Official VIP Invitation Pass for ${candidateName} - Pass #${wardNumber}`
    : `Official Invitation Pass for ${candidateName} - Division ${wardNumber}`;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://event.bhashyamramakrishna.in';
  const canonicalUrl = `${baseUrl}/${cleanSlug}`;

  // Official Invitation Card for standard wards, or branding banner for VIP passes
  const imageUrl = wardNumber <= 76
    ? `https://atkkyaepukxusocjtycm.supabase.co/storage/v1/object/public/invitations/${wardNumber}.jpg`
    : `${baseUrl}/images/kutami-logo.jpg`;

  return {
    title,
    description,
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'event.bhashyamramakrishna.in',
      images: [
        {
          url: imageUrl,
          width: 2160,
          height: 2700,
          alt: `Official Invitation Pass for ${candidateName}`,
          type: 'image/jpeg',
        },
      ],
      type: 'website',
      locale: 'en_IN',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function WardInvitationPage({ params }: PageProps) {
  const { wardSlug } = await params;
  const cleanSlug = wardSlug.toLowerCase().trim();

  // Validate slug pattern:
  // 1. VIP passes: '101-g1lk', '101', 'vip101-g1lk'
  // 2. Division links: 'division1-tpv7', 'division101-g1lk'
  // 3. Printed cards: 'ward1' through 'ward76'
  const match = cleanSlug.match(/^(?:(ward|division|vip)-?)?([0-9]+)(?:-([a-z0-9]{4}))?$/);
  if (!match) {
    notFound();
  }

  const prefix = match[1]; // 'ward' | 'division' | 'vip' | undefined
  const wardNumber = parseInt(match[2], 10);
  const providedHash = match[3]; // optional 4-char hash

  if (isNaN(wardNumber) || wardNumber < 1) {
    notFound();
  }

  // Check authentication on server side
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let isAuthenticated = false;
  let isAdmin = false;

  if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      isAuthenticated = true;
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      isAdmin = profile?.role === 'admin';
    }
  } else {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const roleCookie = cookieStore.get('brk_dev_role')?.value;
    isAuthenticated = !!roleCookie;
    isAdmin = roleCookie === 'admin';
  }

  // Tamper Protection for hash-protected URLs
  if (providedHash) {
    const isHashValid = validateDivisionHash(wardNumber, providedHash);
    if (!isHashValid) {
      return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-rose-200/80 shadow-[0_12px_40px_rgba(225,29,72,0.06)] text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200/60">
              <ShieldX className="w-6 h-6" />
            </div>
            <h1 className="text-lg sm:text-xl font-semibold text-neutral-900 tracking-tight">
              Invalid Invitation Link
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 mt-2 leading-relaxed font-normal">
              This invitation link appears to be altered or contains an invalid verification code.
              Please open the original link sent to you on WhatsApp.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <Link
                href={`/login?returnUrl=${encodeURIComponent(`/${cleanSlug}`)}`}
                className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In as Staff</span>
              </Link>
              <Link
                href="/"
                className="w-full py-2 px-4 bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 font-medium text-xs sm:text-sm rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Home</span>
              </Link>
            </div>
          </div>
        </div>
      );
    }
  } else if (prefix === 'division' && !isAuthenticated) {
    // User typed /division[N] directly without hash and is not logged in
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-amber-200/80 shadow-[0_12px_40px_rgba(245,158,11,0.06)] text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200/60">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-lg sm:text-xl font-semibold text-neutral-900 tracking-tight">
            Secure Link Required
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-2 leading-relaxed font-normal">
            To protect invitee privacy, invitations require the secure link shared via official WhatsApp message.
            Event staff can sign in to view this pass.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Link
              href={`/login?returnUrl=${encodeURIComponent(`/${cleanSlug}`)}`}
              className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>Staff Sign In</span>
            </Link>
            <Link
              href="/"
              className="w-full py-2 px-4 bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 font-medium text-xs sm:text-sm rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Valid /ward[n], verified /101-[hash], verified /division[n]-[hash], or authenticated staff
  return (
    <WardClientView
      wardNumber={wardNumber}
      wardSlug={wardSlug}
      initialAuthenticated={isAuthenticated}
      isAdmin={isAdmin}
    />
  );
}
