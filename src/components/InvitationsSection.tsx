'use client';

import React, { useState, useMemo, useRef } from 'react';
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
  RefreshCw,
  UploadCloud,
  Share2,
  Send,
  Globe,
  ImageIcon
} from 'lucide-react';
import { PartyBadge } from '@/components/PartyBadge';
import WINNING_CORPORATORS from '@/data/winningCorporators.json';

export interface WinningCorporator {
  ward: number;
  nameEn: string;
  party: 'TDP' | 'JSP' | 'BJP' | 'IND';
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

  // Sync / Regeneration state
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [cacheBuster, setCacheBuster] = useState<number>(Date.now());

  const fileInputRef = useRef<HTMLInputElement>(null);
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
      IND: corporators.filter((c) => c.party === 'IND').length,
    };
  }, [corporators]);

  const getCloudImageUrl = (ward: number) => {
    return `${SUPABASE_CDN_BASE}/${ward}.jpg?v=${cacheBuster}`;
  };

  const getCloudQrUrl = (ward: number) => {
    return `${SUPABASE_CDN_BASE}/qr/${ward}.png?v=${cacheBuster}`;
  };

  const handleCopyPassLink = async (ward: number) => {
    const url = `https://event.bhashyamramakrishna.in/ward${ward}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedWard(ward);
      setTimeout(() => setCopiedWard(null), 2000);
    } catch {
      // fallback
    }
  };

  const handleCopyCloudImageUrl = async (ward: number) => {
    const url = `${SUPABASE_CDN_BASE}/${ward}.jpg`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCloudUrlWard(ward);
      setTimeout(() => setCopiedCloudUrlWard(null), 2000);
    } catch {
      // fallback
    }
  };

  const handleShareWhatsApp = (corporator: WinningCorporator) => {
    const imageUrl = `${SUPABASE_CDN_BASE}/${corporator.ward}.jpg`;
    const passUrl = `https://event.bhashyamramakrishna.in/ward${corporator.ward}`;
    const text = 
      `🏛️ *గుంటూరు మున్సిపల్ కార్పొరేషన్ గౌరవ సన్మాన వేడుక*\n` +
      `✨ *Division ${corporator.ward} వార్డు కార్పొరేటర్:* ${corporator.nameTe} (${corporator.nameEn}) - ${corporator.party}\n\n` +
      `🖼️ *అధికారిక ఆహ్వాన పత్రిక (Full HD Image):*\n${imageUrl}\n\n` +
      `🎟️ *డిజిటల్ ఎంట్రీ పాస్ & వేదిక వివరాలు:*\n${passUrl}\n\n` +
      `తేదీ: 17/11/2026 | సాయంత్రం 7:00 గంటల నుండి\n` +
      `వేదిక: భాష్యం ఇంటర్నేషనల్ స్కూల్, గోరంట్ల.`;
    
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleRegenerateAll = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setStatusMessage({ text: 'Regenerating 65 invitations and syncing to cloud storage...', type: 'info' });

    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate' }),
      });
      const data = await res.json();
      if (data.success) {
        setCacheBuster(Date.now());
        setStatusMessage({ text: data.message || 'All invitations regenerated and synced online!', type: 'success' });
      } else {
        setStatusMessage({ text: data.message || 'Failed to regenerate invitations', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Error executing regeneration', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setStatusMessage({ text: `Uploading new template (${file.name}), regenerating and syncing online...`, type: 'info' });

    try {
      const formData = new FormData();
      formData.append('action', 'update_template');
      formData.append('file', file);

      const res = await fetch('/api/invitations', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setCacheBuster(Date.now());
        setStatusMessage({ text: data.message || 'Template updated, regenerated and synced online!', type: 'success' });
      } else {
        setStatusMessage({ text: data.message || 'Failed to update template', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Error updating template', type: 'error' });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Summary & Controls */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 rounded-3xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 text-amber-900 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Official Felicitation Invitations</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
              65 Winning Corporators
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 max-w-xl">
              High-resolution 300 DPI Telugu invitation cards and verified Entry Pass QR codes generated for the 65 election-winning divisions. Stored online on cloud CDN for remote team sharing.
            </p>
          </div>

          {/* Action Buttons for Template Update and Regeneration */}
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleTemplateUpload}
              accept=".png,.jpg,.jpeg,.pdf"
              className="hidden"
            />

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-bold border border-neutral-300/80 shadow-2xs transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <UploadCloud className="w-4 h-4 text-neutral-600" />
              <span>Update Template (PDF/PNG)</span>
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={handleRegenerateAll}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold shadow-2xs transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-white ${isProcessing ? 'animate-spin' : ''}`} />
              <span>{isProcessing ? 'Processing...' : 'Regenerate All & Cloud Sync'}</span>
            </button>
          </div>
        </div>

        {/* Status notification banner if active */}
        {statusMessage && (
          <div
            className={`mt-4 p-3.5 rounded-2xl text-xs font-medium flex items-center justify-between gap-3 border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : statusMessage.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'info' && <RefreshCw className="w-4 h-4 animate-spin text-amber-600 shrink-0" />}
              {statusMessage.type === 'success' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
              {statusMessage.type === 'error' && <X className="w-4 h-4 text-red-600 shrink-0" />}
              <span>{statusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-neutral-400 hover:text-neutral-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
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
          {(['ALL', 'TDP', 'JSP', 'BJP', 'IND'] as const).map((party) => (
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
        <span>Showing {filteredCorporators.length} of 65 invitations</span>
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

      {/* Grid of Invitations */}
      {filteredCorporators.length === 0 ? (
        <div className="text-center py-16 bg-white border border-neutral-200/80 rounded-3xl p-8">
          <Building2 className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-neutral-900">No matching invitations found</h3>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search terms or clearing party filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filteredCorporators.map((c) => (
            <div
              key={c.ward}
              className="bg-white border border-neutral-200/90 rounded-3xl p-4 flex flex-col justify-between shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)] transition-all duration-200 group"
            >
              <div>
                {/* Header: Division + Party */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold bg-neutral-900 text-white tracking-tight">
                    Div {c.ward}
                  </span>
                  <PartyBadge party={c.party} size="sm" />
                </div>

                {/* Names */}
                <div className="mb-3">
                  <h4 className="text-base font-bold text-neutral-900 line-clamp-1" title={c.nameTe}>
                    {c.nameTe}
                  </h4>
                  <p className="text-xs text-neutral-500 line-clamp-1 font-medium mt-0.5" title={c.nameEn}>
                    {c.nameEn}
                  </p>
                </div>

                {/* Card Preview Thumbnail */}
                <div
                  onClick={() => setPreviewWard(c)}
                  className="relative aspect-[4/5] w-full rounded-2xl overflow-hidden border border-neutral-200/80 bg-neutral-100 cursor-pointer shadow-2xs group-hover:border-neutral-300 transition-colors"
                >
                  <img
                    src={`/invitations/${c.ward}.jpg?v=${cacheBuster}`}
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
              <div className="mt-4 pt-3 border-t border-neutral-100 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewWard(c)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold transition-all shadow-2xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>

                  <a
                    href={`/invitations/${c.ward}.jpg`}
                    download={`Invitation_Division_${c.ward}_${c.nameEn.replace(/\s+/g, '_')}.jpg`}
                    title="Download High-Resolution Invitation JPEG (300 DPI)"
                    className="inline-flex items-center justify-center p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </a>

                  <a
                    href={`/invitations/qr/${c.ward}.png`}
                    download={`QR_Division_${c.ward}.png`}
                    title="Download Entry Pass QR Code"
                    className="inline-flex items-center justify-center p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition-colors"
                  >
                    <QrCode className="w-4 h-4" />
                  </a>

                  <Link
                    href={`/ward${c.ward}`}
                    target="_blank"
                    title="Open Digital Pass Link"
                    className="inline-flex items-center justify-center p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>

                {/* Cloud Share & WhatsApp Bar */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleCopyCloudImageUrl(c.ward)}
                    title="Copy Public Online Image Link (for remote sharing)"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[11px] font-semibold transition-all"
                  >
                    {copiedCloudUrlWard === c.ward ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Globe className="w-3 h-3 text-neutral-500" />
                        <span>Copy Image URL</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleShareWhatsApp(c)}
                    title="Share invitation image and pass on WhatsApp"
                    className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-all shadow-2xs"
                  >
                    <Send className="w-3 h-3" />
                    <span>WhatsApp</span>
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
          onClick={() => setPreviewWard(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-neutral-200 flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between gap-3 bg-neutral-50/50">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-neutral-900 text-white">
                  Div {previewWard.ward}
                </span>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 leading-tight">
                    {previewWard.nameTe}
                  </h3>
                  <p className="text-xs text-neutral-500 font-medium">
                    {previewWard.nameEn} • <span className="font-semibold">{previewWard.party}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewWard(null)}
                className="w-9 h-9 rounded-full bg-neutral-200/70 hover:bg-neutral-300 flex items-center justify-center text-neutral-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Image Area */}
            <div className="p-4 sm:p-6 bg-neutral-950 flex items-center justify-center overflow-auto flex-1">
              <img
                src={`/invitations/${previewWard.ward}.jpg?v=${cacheBuster}`}
                alt={`Invitation Division ${previewWard.ward}`}
                className="max-h-[65vh] w-auto rounded-xl shadow-lg border border-neutral-800 object-contain"
              />
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 sm:p-5 border-t border-neutral-100 bg-white flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyCloudImageUrl(previewWard.ward)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold transition-all"
                  >
                    {copiedCloudUrlWard === previewWard.ward ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Image URL Copied!</span>
                      </>
                    ) : (
                      <>
                        <Globe className="w-3.5 h-3.5 text-neutral-600" />
                        <span>Copy Public Image URL</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleShareWhatsApp(previewWard)}
                    className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all shadow-2xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`/invitations/qr/${previewWard.ward}.png`}
                    download={`QR_Division_${previewWard.ward}.png`}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-semibold transition-all"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>QR Code</span>
                  </a>

                  <a
                    href={`/invitations/${previewWard.ward}.jpg`}
                    download={`Invitation_Division_${previewWard.ward}_${previewWard.nameEn.replace(/\s+/g, '_')}.jpg`}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold transition-all shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download JPEG (300 DPI)</span>
                  </a>
                </div>
              </div>

              {/* Public CDN Direct link preview */}
              <div className="text-[11px] text-neutral-500 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200/60 flex items-center justify-between gap-2 overflow-hidden">
                <span className="truncate">
                  <strong className="text-neutral-700 font-semibold">Online CDN URL:</strong> {SUPABASE_CDN_BASE}/{previewWard.ward}.jpg
                </span>
                <span className="text-emerald-700 font-semibold shrink-0">Live & Public</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
