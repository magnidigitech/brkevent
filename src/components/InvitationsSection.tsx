'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Download,
  Eye,
  QrCode,
  ExternalLink,
  Sparkles,
  X,
  Check,
  Copy,
  Building2,
  Share2,
  Globe,
  ImageIcon,
} from 'lucide-react';
import { PartyBadge } from '@/components/PartyBadge';
import { CandidateAvatar } from '@/components/CandidateAvatar';
import WINNING_CORPORATORS from '@/data/winningCorporators.json';
import { cacheAllInvitationsLocally, getInvitationFileForSharing } from '@/lib/offline/invitationCache';

export interface WinningCorporator {
  ward: number;
  nameEn: string;
  party: 'TDP' | 'JSP' | 'BJP';
  nameTe: string;
  nameAnu: string;
}

const SUPABASE_CDN_BASE = 'https://atkkyaepukxusocjtycm.supabase.co/storage/v1/object/public/invitations';

export function InvitationsSection() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParty, setSelectedParty] = useState<string>('ALL');
  const [previewWard, setPreviewWard] = useState<WinningCorporator | null>(null);
  const [copiedWard, setCopiedWard] = useState<number | null>(null);
  const [copiedCloudUrlWard, setCopiedCloudUrlWard] = useState<number | null>(null);
  const [sharingWard, setSharingWard] = useState<number | null>(null);

  // Background pre-cache all 45MB final invitation images into CacheStorage
  useEffect(() => {
    cacheAllInvitationsLocally();
  }, []);

  const handleOpenPreview = (ward: WinningCorporator) => {
    setPreviewWard(ward);
    if (typeof window !== 'undefined') {
      window.history.pushState({ invitationPreview: true, ward: ward.ward }, '', window.location.href);
    }
  };

  const handleClosePreview = () => {
    setPreviewWard(null);
    if (typeof window !== 'undefined' && window.history.state?.invitationPreview) {
      window.history.back();
    }
  };

  // Synchronize history backpress & Escape key
  useEffect(() => {
    if (!previewWard) return;

    const handlePopState = () => {
      setPreviewWard(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClosePreview();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [previewWard]);

  const corporators = WINNING_CORPORATORS as WinningCorporator[];

  // Filtered corporators based on search query and party
  const filteredCorporators = useMemo(() => {
    return corporators.filter((c) => {
      // Party filter
      if (selectedParty !== 'ALL' && c.party !== selectedParty) {
        return false;
      }

      // Search filter
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const wardStr = c.ward.toString();
      const nameEn = c.nameEn.toLowerCase();
      const nameTe = c.nameTe.toLowerCase();

      return (
        wardStr === q ||
        wardStr.includes(q) ||
        nameEn.includes(q) ||
        nameTe.includes(q) ||
        `ward ${wardStr}`.includes(q) ||
        `division ${wardStr}`.includes(q)
      );
    });
  }, [corporators, searchQuery, selectedParty]);

  const partyCounts = useMemo(() => {
    return {
      ALL: corporators.length,
      TDP: corporators.filter((c) => c.party === 'TDP').length,
      JSP: corporators.filter((c) => c.party === 'JSP').length,
      BJP: corporators.filter((c) => c.party === 'BJP').length,
    };
  }, [corporators]);

  const handleCopyPassLink = async (ward: number) => {
    const url = `https://event.bhashyamramakrishna.in/ward${ward}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedWard(ward);
      setTimeout(() => setCopiedWard(null), 2000);
    } catch {}
  };

  const handleCopyCloudImageUrl = async (ward: number) => {
    const url = `${SUPABASE_CDN_BASE}/${ward}.jpg`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCloudUrlWard(ward);
      setTimeout(() => setCopiedCloudUrlWard(null), 2000);
    } catch {}
  };

  const handleShareWhatsApp = async (corporator: WinningCorporator) => {
    setSharingWard(corporator.ward);
    try {
      const imageFile = await getInvitationFileForSharing(corporator.ward);

      // Mobile PWA / Web Share API: Send ONLY the image file (NO TEXT!)
      if (
        imageFile &&
        typeof navigator !== 'undefined' &&
        navigator.canShare &&
        navigator.canShare({ files: [imageFile] })
      ) {
        await navigator.share({
          files: [imageFile],
        });
        return;
      }

      // Desktop browser fallback: Copy image to clipboard and notify
      if (
        imageFile &&
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof ClipboardItem !== 'undefined'
      ) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ [imageFile.type]: imageFile }),
          ]);
          alert('Invitation image copied to clipboard! Opening WhatsApp... Press Ctrl+V / Cmd+V to paste the image.');
          window.open('https://web.whatsapp.com', '_blank');
          return;
        } catch {}
      }

      // Fallback: Direct download of image
      const a = document.createElement('a');
      a.href = `/invitations/${corporator.ward}.jpg`;
      a.download = `Invitation_Division_${corporator.ward}.jpg`;
      a.click();
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Error sharing image:', err);
      }
    } finally {
      setSharingWard(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Summary & Quick Actions */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 rounded-3xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 text-amber-900 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Official Felicitation Invitations</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
              64 Winning Corporators
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 max-w-xl">
              High-resolution final invitation cards for the 64 election-winning divisions. Download high-resolution JPEG, QR code, or share directly on WhatsApp.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="/invitations/BRK_All_Invitations_64_Wards.zip"
              download="BRK_All_Invitations_64_Wards.zip"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold shadow-2xs transition-all active:scale-[0.98]"
            >
              <Download className="w-4 h-4 text-white" />
              <span>Download All 64 Cards (.ZIP)</span>
            </a>

            <a
              href={`${SUPABASE_CDN_BASE}/BRK_All_Invitations_64_Wards.zip`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-bold border border-neutral-300/80 shadow-2xs transition-all active:scale-[0.98]"
            >
              <Globe className="w-4 h-4 text-emerald-600" />
              <span>Cloud CDN Active</span>
            </a>
          </div>
        </div>
      </div>

      {/* Search & Party Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ward #, English or Telugu name..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200/90 rounded-2xl text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Party Filter Pills */}
        <div className="inline-flex items-center gap-1.5 p-1 bg-neutral-200/60 rounded-2xl overflow-x-auto">
          {(['ALL', 'TDP', 'JSP', 'BJP'] as const).map((party) => (
            <button
              key={party}
              onClick={() => setSelectedParty(party)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedParty === party
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {party === 'ALL' ? `All (${partyCounts.ALL})` : `${party} (${partyCounts[party]})`}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count & Cloud Status */}
      <div className="flex items-center justify-between text-xs text-neutral-500 px-1">
        <span>Showing {filteredCorporators.length} of 64 invitations</span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200/60 font-semibold">
            <Globe className="w-3 h-3 text-emerald-600" />
            Online CDN Storage Synced
          </span>
          <span className="text-[11px] bg-neutral-100 text-neutral-600 px-2.5 py-0.5 rounded-full border border-neutral-200/60">
            300 DPI High Definition
          </span>
        </div>
      </div>

      {/* Cards Grid */}
      {filteredCorporators.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-neutral-200/80 shadow-2xs">
          <Building2 className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-neutral-800">No invitations found</h3>
          <p className="text-xs text-neutral-500 mt-1">Try adjusting your search query or party filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredCorporators.map((c) => (
            <div
              key={c.ward}
              className="group bg-white rounded-3xl border border-neutral-200/80 hover:border-neutral-300 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              {/* Card Header & Thumbnail */}
              <div className="p-4 sm:p-5 flex-1">
                {/* Ward and Party Badges */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <CandidateAvatar wardNumber={c.ward} candidateName={c.nameEn} size="sm" />
                    <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-neutral-900 text-white tracking-tight">
                      Div {c.ward}
                    </span>
                  </div>
                  <PartyBadge party={c.party} size="sm" />
                </div>

                {/* Candidate Name */}
                <div className="mb-3">
                  <h3 className="text-base font-bold text-neutral-900 leading-tight tracking-tight">
                    {c.nameTe}
                  </h3>
                  <p className="text-xs text-neutral-500 font-medium mt-0.5">
                    {c.nameEn}
                  </p>
                </div>

                {/* Card Preview Thumbnail */}
                <div
                  onClick={() => handleOpenPreview(c)}
                  className="relative aspect-[4/5] w-full rounded-2xl overflow-hidden border border-neutral-200/80 bg-neutral-100 cursor-pointer shadow-2xs group-hover:border-neutral-300 transition-colors"
                >
                  <img
                    src={`/invitations/${c.ward}.jpg`}
                    alt={`Invitation card for Division ${c.ward}`}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  {/* Hover Action Overlay */}
                  <div className="absolute inset-0 bg-neutral-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 text-white backdrop-blur-[2px]">
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center">
                      <Eye className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs font-semibold tracking-wide">View Full Card</span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-4 pt-3 border-t border-neutral-100 flex flex-col gap-2 p-4 pt-0">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenPreview(c)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold transition-all shadow-2xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>

                  <a
                    href={`/invitations/${c.ward}.jpg`}
                    download={`Invitation_Division_${c.ward}_${c.nameEn.replace(/\s+/g, '_')}.jpg`}
                    className="inline-flex items-center justify-center p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors"
                    title="Download Invitation Card (JPEG)"
                  >
                    <Download className="w-4 h-4" />
                  </a>

                  <a
                    href={`/invitations/qr/${c.ward}.png`}
                    download={`QR_Division_${c.ward}.png`}
                    className="inline-flex items-center justify-center p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors"
                    title="Download QR Code (PNG)"
                  >
                    <QrCode className="w-4 h-4" />
                  </a>

                  <a
                    href={`/ward${c.ward}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors"
                    title="Open Digital Pass URL"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyCloudImageUrl(c.ward)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-medium transition-colors"
                  >
                    {copiedCloudUrlWard === c.ward ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">Copied URL</span>
                      </>
                    ) : (
                      <>
                        <Globe className="w-3.5 h-3.5 text-neutral-500" />
                        <span>Copy Image URL</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={sharingWard === c.ward}
                    onClick={() => handleShareWhatsApp(c)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-60 text-white text-xs font-semibold transition-all shadow-2xs"
                  >
                    <Share2 className={`w-3.5 h-3.5 ${sharingWard === c.ward ? 'animate-spin' : ''}`} />
                    <span>{sharingWard === c.ward ? 'Sharing...' : 'Share Image'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* High-Resolution Preview Modal */}
      {previewWard && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
          onClick={handleClosePreview}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-neutral-200 flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between gap-3 bg-neutral-50/50">
              <div className="flex items-center gap-3">
                <CandidateAvatar wardNumber={previewWard.ward} candidateName={previewWard.nameEn} size="md" />
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-neutral-900 text-white">
                      Div {previewWard.ward}
                    </span>
                    <PartyBadge party={previewWard.party} size="sm" />
                  </div>
                  <h3 className="text-base font-bold text-neutral-900 leading-tight">
                    {previewWard.nameTe}
                  </h3>
                  <p className="text-xs text-neutral-500 font-medium">
                    {previewWard.nameEn}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClosePreview}
                className="w-9 h-9 rounded-full bg-neutral-200/70 hover:bg-neutral-300 flex items-center justify-center text-neutral-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: High Res Card Image */}
            <div className="p-4 sm:p-6 bg-neutral-100/50 overflow-y-auto flex items-center justify-center">
              <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-neutral-200/80">
                <img
                  src={`/invitations/${previewWard.ward}.jpg`}
                  alt={`Invitation Division ${previewWard.ward}`}
                  className="w-full h-auto object-contain"
                />
              </div>
            </div>

            {/* Modal Footer: Action Buttons */}
            <div className="p-4 sm:p-5 border-t border-neutral-100 bg-white flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-1">
                  <button
                    type="button"
                    onClick={() => handleCopyCloudImageUrl(previewWard.ward)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold transition-colors"
                  >
                    {copiedCloudUrlWard === previewWard.ward ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700">Copied Public CDN URL!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-neutral-600" />
                        <span>Copy Image URL</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={sharingWard === previewWard.ward}
                    onClick={() => handleShareWhatsApp(previewWard)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-60 text-white text-xs font-semibold transition-all shadow-2xs"
                  >
                    <Share2 className={`w-4 h-4 ${sharingWard === previewWard.ward ? 'animate-spin' : ''}`} />
                    <span>{sharingWard === previewWard.ward ? 'Sharing...' : 'Share Image on WhatsApp'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`/invitations/qr/${previewWard.ward}.png`}
                    download={`QR_Division_${previewWard.ward}.png`}
                    className="inline-flex items-center gap-1.5 py-2.5 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold transition-colors"
                  >
                    <QrCode className="w-4 h-4" />
                    <span className="hidden sm:inline">QR Code</span>
                  </a>

                  <a
                    href={`/invitations/${previewWard.ward}.jpg`}
                    download={`Invitation_Division_${previewWard.ward}_${previewWard.nameEn.replace(/\s+/g, '_')}.jpg`}
                    className="inline-flex items-center gap-1.5 py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold transition-colors shadow-2xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Card</span>
                  </a>
                </div>
              </div>

              {/* Public CDN Direct link preview */}
              <div className="text-[11px] text-neutral-400 bg-neutral-50 px-3 py-1.5 rounded-xl border border-neutral-100 truncate">
                <span className="font-semibold text-neutral-600">Online CDN URL:</span>{' '}
                <span className="select-all font-mono text-[10px] text-neutral-500">
                  {SUPABASE_CDN_BASE}/{previewWard.ward}.jpg
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
