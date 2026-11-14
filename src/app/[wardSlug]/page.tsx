import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WardClientView } from './WardClientView';

interface PageProps {
  params: Promise<{ wardSlug: string }>;
}

export default async function WardInvitationPage({ params }: PageProps) {
  const { wardSlug } = await params;

  // Validate slug pattern: ward1 through ward76
  const match = wardSlug.toLowerCase().match(/^ward([0-9]+)$/);
  if (!match) {
    notFound();
  }

  const wardNumber = parseInt(match[1], 10);
  if (isNaN(wardNumber) || wardNumber < 1 || wardNumber > 76) {
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

    if (!user) {
      // Must not expose guest details or permit unauthenticated data changes.
      // Show login and return them to that ward after login.
      redirect(`/login?returnUrl=/${wardSlug}`);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    isAuthenticated = true;
    isAdmin = profile?.role === 'admin';
  } else {
    // Dev mode fallback check
    isAuthenticated = true; // In dev mode without Supabase, allow testing
  }

  return (
    <WardClientView
      wardNumber={wardNumber}
      wardSlug={wardSlug}
      isAdmin={isAdmin}
    />
  );
}

