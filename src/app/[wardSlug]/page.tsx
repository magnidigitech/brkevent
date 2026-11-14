import React from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WardClientView } from './WardClientView';

interface PageProps {
  params: Promise<{ wardSlug: string }>;
}

export const dynamic = 'force-dynamic';

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
    // Dev fallback mode allows testing
    isAuthenticated = true;
    isAdmin = true;
  }

  // Do NOT redirect to /login! Preserve the simple URL /ward[n] directly!
  return (
    <WardClientView
      wardNumber={wardNumber}
      wardSlug={wardSlug}
      initialAuthenticated={isAuthenticated}
      isAdmin={isAdmin}
    />
  );
}
