'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Building2,
  AlertTriangle,
  Utensils,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  ShieldCheck,
  Edit,
  History,
  FileSpreadsheet,
  AlertCircle,
  LayoutGrid,
  Table as TableIcon,
  Phone,
  QrCode,
  ArrowRight,
  X,
  UserCheck,
  Settings,
  Sparkles,
  Check,
  CheckCheck,
  Menu,
  SlidersHorizontal,
  ChevronRight,
  UserPlus
} from 'lucide-react';
import { WardWithStats, ArrivalBatch, DashboardSummary } from '@/types/database';
import { PartyBadge } from '@/components/PartyBadge';
import { AdminWardEditModal } from '@/components/AdminWardEditModal';
import { AddSpecialGuestModal } from '@/components/AddSpecialGuestModal';
import { WardEntryCard } from '@/components/WardEntryCard';
import { SettingsModal } from '@/components/SettingsModal';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { InvitationsSection } from '@/components/InvitationsSection';
import { createClient } from '@/lib/supabase/client';
import { formatInKolkataTime } from '@/lib/utils/date';
import { stopAllCameraStreams } from '@/lib/camera/cameraManager';
import WINNING_CORPORATORS from '@/data/winningCorporators.json';

const WINNING_WARD_NUMBERS = new Set(WINNING_CORPORATORS.map((w) => w.ward));

export type DashboardTab = 'entries' | 'food' | 'history' | 'audit' | 'invitations';

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [wards, setWards] = useState<WardWithStats[]>([]);
  const [recentBatches, setRecentBatches] = useState<ArrivalBatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  // Primary Segment / Active Tab
  const [activeTab, setActiveTab] = useState<DashboardTab>('entries');

  // Display Mode: 'cards' (default mobile friendly) | 'table'
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // AJAX Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [partyFilter, setPartyFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL'); // 'ALL' | 'ARRIVED' | 'NOT_ARRIVED' | 'OVER_ALLOWANCE'
  const [foodFilter, setFoodFilter] = useState<string>('ALL'); // 'ALL' | 'CONFIRMED' | 'UNCONFIRMED' | 'UNSET' | 'MISMATCH'
  const [scopeFilter, setScopeFilter] = useState<'WINNERS' | 'SPECIAL' | 'ALL'>('WINNERS');

  // Add Special Guest Modal State
  const [isAddSpecialGuestOpen, setIsAddSpecialGuestOpen] = useState<boolean>(false);

  // Admin Ward Edit Modal State
  const [selectedWardForEdit, setSelectedWardForEdit] = useState<WardWithStats | null>(null);

  // Instant Record Arrival Modal State (0ms open)
  const [selectedWardForArrival, setSelectedWardForArrival] = useState<WardWithStats | null>(null);

  // Settings Modal State (WhatsApp message pattern)
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Mobile Hamburger Drawer State (moves all options into bottom sheet menu on mobile)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Void Batch Modal State
  const [batchToVoid, setBatchToVoid] = useState<ArrivalBatch | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');
  const [voiding, setVoiding] = useState<boolean>(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Load Dashboard Data (Ultra-fast single query)
  const loadDashboardData = useCallback(async (isBackground: boolean = false) => {
    try {
      if (!isBackground) setRefreshing(true);

      const res = await fetch('/api/dashboard');
      const data = await res.json();

      if (data.success) {
        setSummary(data.summary);
        setWards(data.wards || []);
        setRecentBatches(data.recent_batches || []);
      }

      setLastRefreshed(new Date().toISOString());
    } catch (err) {
      console.error('Failed to refresh dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Multi-Device Realtime & Fast AJAX Sync (reflects phone arrivals across devices without page reload)
  useEffect(() => {
    // Forcefully shut down any lingering scanner camera streams when on dashboard
    stopAllCameraStreams();

    loadDashboardData();

    // Rapid AJAX polling every 3 seconds while tab is visible
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadDashboardData(true);
      }
    }, 3000);

    // Instant AJAX refresh when returning to this tab or unlocking phone screen
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadDashboardData(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen for mobile bottom nav "Options" tap
    const handleOpenOptions = () => setIsMobileMenuOpen(true);
    window.addEventListener('open-dashboard-options', handleOpenOptions);

    // Cross-tab broadcast channel for instant 0ms sync on same device
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('brk_sync_channel');
        bc.onmessage = () => {
          loadDashboardData(true);
        };
      } catch {}
    }

    // Supabase Realtime channel for live cross-device multi-phone sync
    let supabaseSub: any = null;
    try {
      const supabase = createClient();
      supabaseSub = supabase
        .channel('dashboard-live-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'arrival_batches' },
          () => {
            loadDashboardData(true);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'wards' },
          () => {
            loadDashboardData(true);
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription fallback to rapid AJAX polling:', err);
    }

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('open-dashboard-options', handleOpenOptions);
      if (bc) bc.close();
      if (supabaseSub) {
        try {
          const supabase = createClient();
          supabase.removeChannel(supabaseSub);
        } catch {}
      }
    };
  }, [loadDashboardData]);

  // Fetch Audit Logs when Audit Tab is opened
  useEffect(() => {
    if (activeTab === 'audit') {
      fetch('/api/audit-logs')
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setAuditLogs(data.logs || []);
        })
        .catch((err) => console.error(err));
    }
  }, [activeTab]);

  // Handle Void Batch Submission
  const handleConfirmVoid = async () => {
    if (!batchToVoid || !voidReason.trim()) {
      setVoidError('Please specify a reason for voiding this record.');
      return;
    }

    try {
      setVoiding(true);
      setVoidError(null);

      const res = await fetch('/api/arrivals/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: batchToVoid.id,
          reason: voidReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to void batch.');
      }

      setBatchToVoid(null);
      setVoidReason('');
      await loadDashboardData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error voiding record.';
      setVoidError(msg);
    } finally {
      setVoiding(false);
    }
  };

  // Active scope wards (Winning 64 vs Special Guests vs All)
  const activeScopeWards = useMemo(() => {
    if (scopeFilter === 'WINNERS') {
      return wards.filter((w) => WINNING_WARD_NUMBERS.has(w.ward_number));
    }
    if (scopeFilter === 'SPECIAL') {
      return wards.filter((w) => w.ward_number >= 101 || ['VIP', 'SPECIAL', 'GUEST', 'ALLIANCE'].includes(w.party));
    }
    return wards;
  }, [wards, scopeFilter]);

  // Recalculate summary metrics dynamically based on active scope
  const displaySummary = useMemo(() => {
    const totalCount = activeScopeWards.length;
    let totalEntered = 0;
    let wardsWithArrivals = 0;
    let wardsWithoutArrivals = 0;
    let wardsExceedingAllowance = 0;
    let totalExcessPeople = 0;
    let expectedVegTotal = 0;
    let expectedNonVegTotal = 0;
    let wardsUnconfirmedFood = 0;
    let dynamicCap = 0;

    activeScopeWards.forEach((w) => {
      totalEntered += w.total_entered;
      dynamicCap += (w.allowance || 5);
      if (w.total_entered > 0) wardsWithArrivals += 1;
      else wardsWithoutArrivals += 1;

      if (w.total_entered > w.allowance) {
        wardsExceedingAllowance += 1;
        totalExcessPeople += w.total_entered - w.allowance;
      }

      if (w.expected_veg !== null && w.expected_veg !== undefined) {
        expectedVegTotal += w.expected_veg;
      }
      if (w.expected_non_veg !== null && w.expected_non_veg !== undefined) {
        expectedNonVegTotal += w.expected_non_veg;
      }
      if (!w.food_confirmed) {
        wardsUnconfirmedFood += 1;
      }
    });

    return {
      total_entered: totalEntered,
      normal_total_allowance: dynamicCap,
      wards_with_arrivals: wardsWithArrivals,
      wards_without_arrivals: wardsWithoutArrivals,
      wards_exceeding_allowance: wardsExceedingAllowance,
      total_excess_people: totalExcessPeople,
      expected_veg_total: expectedVegTotal,
      expected_non_veg_total: expectedNonVegTotal,
      wards_unconfirmed_food: wardsUnconfirmedFood,
      total_wards: totalCount,
    };
  }, [activeScopeWards]);

  // Instant AJAX Filter & Priority Sort Wards
  const filteredWards = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const isPureDigits = /^\d+$/.test(q);
    const queryDigits = q.replace(/\D/g, '');
    const digitCount = queryDigits.length;

    // Rule: For 1 or 2 digits, search strictly by Ward number (do NOT match random 2-digit pairs in phone numbers).
    // If more than 2 digits (3+ digits, e.g. "98851", "4343"), check against phone numbers.
    const allowPhoneSearch = digitCount > 2;

    const wardPrefixMatch = q.match(/^(?:w|ward|d|div|division|pass|vip|guest)[ -]?(\d{1,4})$/i);
    const targetWardNum = isPureDigits
      ? parseInt(q, 10)
      : wardPrefixMatch
      ? parseInt(wardPrefixMatch[1], 10)
      : null;

    const matches = activeScopeWards.filter((w) => {
      if (q) {
        let matchWardNo = false;
        if (targetWardNum !== null) {
          matchWardNo = w.ward_number === targetWardNum;
        } else if (!isPureDigits && q.length > 2) {
          matchWardNo =
            `division ${w.ward_number}` === q ||
            `ward ${w.ward_number}` === q ||
            `pass ${w.ward_number}` === q ||
            `guest ${w.ward_number}` === q;
        }

        const matchName = !isPureDigits && w.candidate_name ? w.candidate_name.toLowerCase().includes(q) : false;
        const matchParty = !isPureDigits && w.party ? w.party.toLowerCase().includes(q) : false;
        const cleanPhone = w.phone ? w.phone.replace(/\D/g, '') : '';
        const matchPhone = allowPhoneSearch && cleanPhone.includes(queryDigits);
        const matchGuests = !isPureDigits && w.guests?.some((g) => g.guest_name.toLowerCase().includes(q));

        if (!matchWardNo && !matchName && !matchParty && !matchPhone && !matchGuests) return false;
      }

      // Party filter
      if (partyFilter !== 'ALL' && w.party !== partyFilter) {
        return false;
      }

      // Attendance status filter (applies to 'entries')
      if (activeTab === 'entries') {
        if (statusFilter === 'ARRIVED' && w.total_entered === 0) return false;
        if (statusFilter === 'NOT_ARRIVED' && w.total_entered > 0) return false;
        if (statusFilter === 'OVER_ALLOWANCE' && w.total_entered <= w.allowance) return false;
      }

      // Food filter (applies to 'food')
      if (activeTab === 'food') {
        const totalFood = (w.expected_veg || 0) + (w.expected_non_veg || 0);
        const hasFoodSet = w.expected_veg !== null || w.expected_non_veg !== null;
        if (foodFilter === 'CONFIRMED' && !w.food_confirmed) return false;
        if (foodFilter === 'UNCONFIRMED' && w.food_confirmed) return false;
        if (foodFilter === 'UNSET' && hasFoodSet) return false;
        if (foodFilter === 'MISMATCH' && (!hasFoodSet || totalFood === w.allowance)) return false;
      }

      return true;
    });

    // Priority Ranking:
    // If query has exact ward target, rank that exact ward at top
    if (targetWardNum !== null) {
      return matches.sort((a, b) => {
        const aExact = a.ward_number === targetWardNum;
        const bExact = b.ward_number === targetWardNum;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        return a.ward_number - b.ward_number;
      });
    }

    return matches;
  }, [activeScopeWards, searchQuery, partyFilter, activeTab, statusFilter, foodFilter]);

  return (
    <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full pb-28 sm:pb-8">
      {/* Top Header & Realtime Controls (Apple Minimalist Style) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 tracking-tight">
            Event Operations
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1 font-normal">
            Realtime attendance tracking, allowance auditing, and catering totals for all 76 divisions.
          </p>
        </div>

        {/* Sync Status & Action Buttons (Desktop Full, Mobile Hamburger) */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Refresh status pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-black/[0.08] text-xs font-medium text-neutral-600 shadow-2xs">
            <span className={`w-2 h-2 rounded-full ${refreshing ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
            <span className="hidden xs:inline">Refreshed:</span>
            <span>{lastRefreshed ? formatInKolkataTime(lastRefreshed, { includeTime: true }) : 'Syncing...'}</span>
          </div>

          <button
            onClick={() => loadDashboardData()}
            disabled={refreshing}
            className="p-2 bg-white hover:bg-neutral-50 border border-black/[0.08] rounded-xl text-neutral-700 shadow-2xs transition-colors"
            title="Refresh Totals"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-neutral-900' : ''}`} />
          </button>

          {/* Desktop Only Actions */}
          <div className="hidden sm:flex items-center gap-2">
            {/* Add Special Guest Button */}
            <button
              type="button"
              onClick={() => setIsAddSpecialGuestOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
              title="Add Special Guest / VIP Invitee"
            >
              <UserPlus className="w-3.5 h-3.5 text-purple-600" />
              <span>+ Add Guest / VIP</span>
            </button>

            {/* WhatsApp & Message Settings Button */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-neutral-50 border border-black/[0.08] text-neutral-800 rounded-xl text-xs font-medium shadow-2xs transition-colors"
              title="Configure WhatsApp Message Pattern & Formatting"
            >
              <Settings className="w-3.5 h-3.5 text-neutral-500" />
              <span>Settings</span>
            </button>

            {/* CSV Export Buttons */}
            <a
              href="/api/export/wards"
              download
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-neutral-50 text-neutral-900 border border-black/[0.08] rounded-xl text-xs font-medium shadow-2xs transition-colors"
              title="Export Division Summary CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-neutral-500" />
              <span>Export Divisions</span>
            </a>

            <a
              href="/api/export/entries"
              download
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-medium shadow-xs transition-all active:scale-[0.99]"
              title="Export Entry History CSV"
            >
              <History className="w-3.5 h-3.5 text-neutral-300" />
              <span>Export Entries</span>
            </a>
          </div>

          {/* Mobile Hamburger Options Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="sm:hidden flex items-center gap-1.5 px-3 py-2 bg-neutral-900 text-white rounded-xl text-xs font-medium shadow-xs active:scale-95 transition-all"
            title="Open Controls Menu"
            aria-label="Open Controls Menu"
          >
            <Menu className="w-4 h-4" />
            <span>Options</span>
          </button>
        </div>
      </div>

      {/* METRIC STAT CARDS - ADAPTIVE TO ACTIVE SEGMENT */}
      {displaySummary && (
        <>
          {/* SEGMENT 1: GATE ENTRIES METRICS */}
          {activeTab === 'entries' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-7">
              {/* Total People Entered */}
              <div className="bg-white rounded-2xl p-5 border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between text-neutral-500">
                  <span className="text-xs font-medium">Total Entered</span>
                  <Users className="w-4 h-4 text-neutral-400" />
                </div>
                <div className="mt-2.5">
                  <span className="text-3xl font-semibold tracking-tight text-neutral-900">{displaySummary.total_entered}</span>
                  <span className="text-xs text-neutral-400 ml-1.5">/ {displaySummary.normal_total_allowance} cap</span>
                </div>
                <div className="mt-3 w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-neutral-900 h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (displaySummary.total_entered / displaySummary.normal_total_allowance) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Wards Attendance Progress */}
              <div className="bg-white rounded-2xl p-5 border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between text-neutral-500">
                  <span className="text-xs font-medium">Divisions Arrived</span>
                  <Building2 className="w-4 h-4 text-neutral-400" />
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold tracking-tight text-neutral-900">{displaySummary.wards_with_arrivals}</span>
                  <span className="text-xs text-neutral-400">/ {displaySummary.total_wards} Divisions</span>
                </div>
                <p className="text-xs text-neutral-500 mt-2.5">
                  <span className="font-medium text-neutral-800">{displaySummary.wards_without_arrivals}</span> pending
                </p>
              </div>

              {/* Excess People & Wards */}
              <div className={`rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                displaySummary.wards_exceeding_allowance > 0
                  ? 'bg-rose-50/50 border-rose-200/80 shadow-[0_2px_12px_rgba(225,29,72,0.06)]'
                  : 'bg-white border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)]'
              }`}>
                <div className="flex items-center justify-between text-neutral-500">
                  <span className={`text-xs font-medium ${displaySummary.wards_exceeding_allowance > 0 ? 'text-rose-700' : ''}`}>
                    Excess Attendees
                  </span>
                  <AlertTriangle className={`w-4 h-4 ${displaySummary.wards_exceeding_allowance > 0 ? 'text-rose-600' : 'text-neutral-400'}`} />
                </div>
                <div className="mt-2.5">
                  <span className={`text-3xl font-semibold tracking-tight ${displaySummary.total_excess_people > 0 ? 'text-rose-700' : 'text-neutral-900'}`}>
                    +{displaySummary.total_excess_people}
                  </span>
                  <span className={`text-xs ml-1.5 ${displaySummary.total_excess_people > 0 ? 'text-rose-600' : 'text-neutral-400'}`}>
                    over 5/division
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-2.5">
                  <span className={`font-medium ${displaySummary.wards_exceeding_allowance > 0 ? 'text-rose-700' : 'text-neutral-800'}`}>
                    {displaySummary.wards_exceeding_allowance}
                  </span> divisions exceeding
                </p>
              </div>

              {/* Normal Combined Capacity */}
              <div className="bg-white rounded-2xl p-5 border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between text-neutral-500">
                  <span className="text-xs font-medium">Remaining Capacity</span>
                  <UserCheck className="w-4 h-4 text-neutral-400" />
                </div>
                <div className="mt-2.5">
                  <span className="text-3xl font-semibold tracking-tight text-neutral-900">
                    {Math.max(0, displaySummary.normal_total_allowance - displaySummary.total_entered)}
                  </span>
                  <span className="text-xs text-neutral-400 ml-1.5">slots left</span>
                </div>
                <p className="text-xs text-neutral-500 mt-2.5">
                  Standard cap: {displaySummary.normal_total_allowance} total
                </p>
              </div>
            </div>
          )}

          {/* SEGMENT 2: FOOD PLANNING METRICS */}
          {activeTab === 'food' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-7">
              {/* Expected Veg */}
              <div className="bg-white rounded-2xl p-5 border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between text-neutral-500">
                  <span className="text-xs font-medium">Vegetarian</span>
                  <Utensils className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-2.5">
                  <span className="text-3xl font-semibold tracking-tight text-neutral-900">{displaySummary.expected_veg_total}</span>
                  <span className="text-xs text-neutral-400 ml-1.5">meals</span>
                </div>
                <p className="text-xs text-neutral-500 mt-2.5">
                  Expected pure veg plates
                </p>
              </div>

              {/* Expected Non-Veg */}
              <div className="bg-white rounded-2xl p-5 border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between text-neutral-500">
                  <span className="text-xs font-medium">Non-Vegetarian</span>
                  <Utensils className="w-4 h-4 text-amber-600" />
                </div>
                <div className="mt-2.5">
                  <span className="text-3xl font-semibold tracking-tight text-neutral-900">{displaySummary.expected_non_veg_total}</span>
                  <span className="text-xs text-neutral-400 ml-1.5">meals</span>
                </div>
                <p className="text-xs text-neutral-500 mt-2.5">
                  Expected non-veg plates
                </p>
              </div>

              {/* Total Planned Meals */}
              <div className="bg-white rounded-2xl p-5 border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between text-neutral-500">
                  <span className="text-xs font-medium">Total Meals</span>
                  <Sparkles className="w-4 h-4 text-neutral-400" />
                </div>
                <div className="mt-2.5">
                  <span className="text-3xl font-semibold tracking-tight text-neutral-900">
                    {displaySummary.expected_veg_total + displaySummary.expected_non_veg_total}
                  </span>
                  <span className="text-xs text-neutral-400 ml-1.5">/ {displaySummary.normal_total_allowance} baseline</span>
                </div>
                <p className="text-xs text-neutral-500 mt-2.5">
                  Combined veg + non-veg total
                </p>
              </div>

              {/* Confirmation Progress */}
              <div className="bg-white rounded-2xl p-5 border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between text-neutral-500">
                  <span className="text-xs font-medium">Food Confirmation</span>
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold tracking-tight text-neutral-900">
                    {displaySummary.total_wards - displaySummary.wards_unconfirmed_food}
                  </span>
                  <span className="text-xs text-neutral-400">/ {displaySummary.total_wards} Confirmed</span>
                </div>
                <p className="text-xs text-neutral-500 mt-2.5">
                  <span className="font-medium text-amber-700">{displaySummary.wards_unconfirmed_food}</span> divisions pending confirmation
                </p>
              </div>
            </div>
          )}

          {/* OVERVIEW FOR HISTORY / AUDIT TABS */}
          {(activeTab === 'history' || activeTab === 'audit') && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-7">
              <div className="bg-white rounded-2xl p-5 border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <span className="text-xs font-medium text-neutral-500 block">Total Entered</span>
                <span className="text-3xl font-semibold tracking-tight text-neutral-900 mt-1 block">{displaySummary.total_entered}</span>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <span className="text-xs font-medium text-neutral-500 block">Divisions Arrived</span>
                <span className="text-3xl font-semibold tracking-tight text-neutral-900 mt-1 block">{displaySummary.wards_with_arrivals} / {displaySummary.total_wards}</span>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <span className="text-xs font-medium text-neutral-500 block">Total Excess</span>
                <span className="text-3xl font-semibold tracking-tight text-rose-700 mt-1 block">+{displaySummary.total_excess_people}</span>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <span className="text-xs font-medium text-neutral-500 block">Recorded Batches</span>
                <span className="text-3xl font-semibold tracking-tight text-neutral-900 mt-1 block">{recentBatches.length}</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* MOBILE CONTROL BAR (Replaces bulky segmented bar on mobile screens) */}
      <div className="sm:hidden flex items-center justify-between bg-white p-3 rounded-2xl border border-black/[0.06] shadow-2xs mb-5">
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex items-center gap-2.5 text-left flex-1"
        >
          <span className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-800 shrink-0">
            {activeTab === 'entries' && <Users className="w-4 h-4" />}
            {activeTab === 'food' && <Utensils className="w-4 h-4" />}
            {activeTab === 'history' && <History className="w-4 h-4" />}
            {activeTab === 'audit' && <ShieldCheck className="w-4 h-4" />}
            {activeTab === 'invitations' && <Sparkles className="w-4 h-4 text-amber-500" />}
          </span>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-neutral-900 leading-tight">
              {activeTab === 'entries' && `Gate Entries (${wards.length})`}
              {activeTab === 'food' && `Food Planning (${wards.length})`}
              {activeTab === 'history' && `History (${recentBatches.length})`}
              {activeTab === 'audit' && 'Audit Trail'}
              {activeTab === 'invitations' && 'Invitations (65)'}
            </span>
            <span className="text-[11px] text-neutral-400 font-normal flex items-center gap-1 mt-0.5">
              <span>Tap to switch view</span>
              <ChevronRight className="w-3 h-3 text-neutral-400" />
            </span>
          </div>
        </button>

        {/* Quick View Style toggle (Cards / Table) */}
        {(activeTab === 'entries' || activeTab === 'food') && (
          <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl shrink-0 ml-2">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'cards' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-400'
              }`}
              title="Card View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'table' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-400'
              }`}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* DESKTOP NAVIGATION SEGMENTED CONTROL & VIEW TOGGLE (APPLE STYLE) */}
      <div className="hidden sm:flex sm:items-center sm:justify-between gap-3 mb-6">
        <div className="inline-flex items-center bg-neutral-200/70 p-1 rounded-2xl gap-1 overflow-x-auto max-w-full">
          {/* SEGMENT 1: GATE ENTRIES */}
          <button
            onClick={() => {
              setActiveTab('entries');
              setSearchQuery('');
            }}
            className={`px-4 py-2 text-xs sm:text-sm rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'entries'
                ? 'bg-white text-neutral-900 font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                : 'text-neutral-600 hover:text-neutral-900 font-medium'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Gate Entries & Attendance ({wards.length})</span>
          </button>

          {/* SEGMENT 2: FOOD PLANNING */}
          <button
            onClick={() => {
              setActiveTab('food');
              setSearchQuery('');
            }}
            className={`px-4 py-2 text-xs sm:text-sm rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'food'
                ? 'bg-white text-neutral-900 font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                : 'text-neutral-600 hover:text-neutral-900 font-medium'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Food & Catering Planning ({wards.length})</span>
          </button>

          {/* ENTRY HISTORY */}
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-xs sm:text-sm rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-white text-neutral-900 font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                : 'text-neutral-600 hover:text-neutral-900 font-medium'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History ({recentBatches.length})</span>
          </button>

          {/* AUDIT TRAIL */}
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 text-xs sm:text-sm rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'bg-white text-neutral-900 font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                : 'text-neutral-600 hover:text-neutral-900 font-medium'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Audit Trail</span>
          </button>

          {/* INVITATIONS (65 WINNING CORPORATORS) */}
          <button
            onClick={() => {
              setActiveTab('invitations');
              setSearchQuery('');
            }}
            className={`px-4 py-2 text-xs sm:text-sm rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'invitations'
                ? 'bg-white text-neutral-900 font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                : 'text-neutral-600 hover:text-neutral-900 font-medium'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Invitations (65)</span>
          </button>
        </div>

        {/* View Style Switcher: Cards vs Table */}
        {(activeTab === 'entries' || activeTab === 'food') && (
          <div className="inline-flex items-center bg-neutral-200/70 p-1 rounded-2xl gap-1 self-end sm:self-auto">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                viewMode === 'cards'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SEGMENT 1: GATE ENTRIES & ATTENDANCE ONLY */}
      {/* ========================================================================= */}
      {activeTab === 'entries' && (
        <div className="flex flex-col gap-5">
          {/* AJAX Search & Gate Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* AJAX Search Input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Instant AJAX search: type division #, candidate, party, phone, or guest..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-neutral-50/80 focus:bg-white border border-neutral-200 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 rounded-xl transition-all text-neutral-900 outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 p-0.5"
                    title="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filter Dropdowns */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Scope Filter */}
                <select
                  value={scopeFilter}
                  onChange={(e) => setScopeFilter(e.target.value as 'WINNERS' | 'SPECIAL' | 'ALL')}
                  className="px-3.5 py-2 text-xs font-semibold border border-amber-300 rounded-xl bg-amber-50/80 text-amber-900 focus:border-amber-600 focus:outline-none transition-colors"
                >
                  <option value="WINNERS">Winning Corporators (64)</option>
                  <option value="SPECIAL">Special Guests & VIPs</option>
                  <option value="ALL">All Invitees & Divisions</option>
                </select>

                {/* Party Filter */}
                <select
                  value={partyFilter}
                  onChange={(e) => setPartyFilter(e.target.value)}
                  className="px-3.5 py-2 text-xs font-medium border border-neutral-200 rounded-xl bg-neutral-50/80 text-neutral-800 focus:border-neutral-900 focus:outline-none transition-colors"
                >
                  <option value="ALL">All Categories</option>
                  <option value="TDP">TDP</option>
                  <option value="JSP">JSP</option>
                  <option value="BJP">BJP</option>
                  <option value="VIP">VIP Invitees</option>
                  <option value="SPECIAL">Special Guests</option>
                  <option value="ALLIANCE">Alliance Leaders</option>
                </select>

                {/* Attendance Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3.5 py-2 text-xs font-medium border border-neutral-200 rounded-xl bg-neutral-50/80 text-neutral-800 focus:border-neutral-900 focus:outline-none transition-colors"
                >
                  <option value="ALL">All Attendance</option>
                  <option value="ARRIVED">Arrived (&gt;0)</option>
                  <option value="NOT_ARRIVED">Not Arrived (0)</option>
                  <option value="OVER_ALLOWANCE">Over Allowance (&gt;5)</option>
                </select>

                {(searchQuery || partyFilter !== 'ALL' || statusFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setPartyFilter('ALL');
                      setStatusFilter('ALL');
                    }}
                    className="px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Quick Result Counter */}
            <div className="flex items-center justify-between text-xs text-neutral-400 pt-1 border-t border-black/[0.04]">
              <span>
                Showing <strong className="text-neutral-700 font-semibold">{filteredWards.length}</strong> of {activeScopeWards.length} divisions
                {searchQuery && ` matching "${searchQuery}"`}
              </span>
              <span className="hidden sm:inline">5-person total allowance per division</span>
            </div>
          </div>

          {/* CARD STYLE VIEW (Gate Attendance Only - Apple Style) */}
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredWards.length === 0 ? (
                <div className="col-span-full bg-white rounded-2xl p-12 text-center text-neutral-500 border border-black/[0.06]">
                  <Search className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                  <p className="font-semibold text-base text-neutral-800">No divisions match your search</p>
                  <p className="text-xs text-neutral-400 mt-1">Try typing a different candidate name, party, or division number.</p>
                </div>
              ) : (
                filteredWards.map((w) => {
                  const isOver = w.total_entered > w.allowance;
                  const isFull = w.total_entered === w.allowance;
                  return (
                    <div
                      key={w.ward_number}
                      className={`bg-white rounded-2xl p-5 border transition-all shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] flex flex-col justify-between ${
                        isOver
                          ? 'border-rose-200/80 bg-rose-50/15'
                          : 'border-black/[0.06]'
                      }`}
                    >
                      {/* Card Header */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm border shadow-2xs ${
                                w.party === 'TDP'
                                  ? 'bg-[#FFF6CC] text-[#7A5B00] border-[#FFCC00]/40'
                                  : w.party === 'JSP'
                                  ? 'bg-[#FFEBEA] text-[#D70015] border-[#FF3B30]/30'
                                  : w.party === 'BJP'
                                  ? 'bg-[#FFF1E5] text-[#C93400] border-[#FF9500]/30'
                                  : 'bg-purple-100 text-purple-800 border-purple-200'
                              }`}
                            >
                              {w.ward_number}
                            </span>
                            <div>
                              <span className="text-xs text-neutral-400 font-medium block">
                                {w.ward_number >= 101 ? 'VIP / Special Pass' : `Division ${w.ward_number}`}
                              </span>
                              <h3 className="font-semibold text-base text-neutral-900 leading-snug tracking-tight">
                                {w.candidate_name}
                              </h3>
                            </div>
                          </div>
                          <PartyBadge party={w.party} size="sm" />
                        </div>

                        {/* Clickable Phone & WhatsApp Trigger */}
                        {w.phone ? (
                          <div className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-xl bg-neutral-50 border border-neutral-200/70 mb-3.5 text-xs">
                            <a
                              href={`tel:${w.phone}`}
                              className="flex items-center gap-1.5 text-neutral-700 hover:text-blue-600 font-medium transition-colors font-mono"
                              title="Click to Call"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Phone className="w-3.5 h-3.5 text-neutral-400" />
                              <span>{w.phone}</span>
                            </a>
                            <WhatsAppButton ward={w} variant="pill" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-between mb-3.5 text-xs text-neutral-400">
                            <span className="italic font-normal">No phone listed</span>
                            <button
                              type="button"
                              onClick={() => setSelectedWardForEdit(w)}
                              className="text-neutral-700 hover:text-neutral-900 font-medium"
                            >
                              + Add Phone
                            </button>
                          </div>
                        )}

                        {/* Attendance Counter & Progress */}
                        <div className="bg-neutral-50/80 rounded-xl p-3.5 mb-3.5 border border-black/[0.04]">
                          <div className="flex items-center justify-between text-xs mb-2">
                            <span className="font-medium text-neutral-500">Gate Attendance</span>
                            <span className="font-medium text-neutral-900">
                              <span className={`text-base font-semibold ${isOver ? 'text-rose-600' : 'text-neutral-900'}`}>
                                {w.total_entered}
                              </span>{' '}
                              / {w.allowance} allowance
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden mb-2.5">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                isOver ? 'bg-rose-600' : isFull ? 'bg-amber-500' : 'bg-neutral-900'
                              }`}
                              style={{ width: `${Math.min(100, (w.total_entered / w.allowance) * 100)}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            {isOver ? (
                              <span className="font-medium text-rose-700 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded-md">
                                +{w.excess_count} Excess
                              </span>
                            ) : isFull ? (
                              <span className="font-medium text-amber-800 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md">
                                Exact Capacity
                              </span>
                            ) : (
                              <span className="text-neutral-500 font-normal">
                                {w.remaining_allowance} slots remaining
                              </span>
                            )}

                            <span className="text-neutral-400 font-normal">
                              {w.recent_batches.filter((b) => !b.is_voided).length} batches
                            </span>
                          </div>
                        </div>

                        {/* Accompanying Guests Preview if any */}
                        {w.guests && w.guests.length > 0 && (
                          <div className="mb-3.5 text-xs text-neutral-500">
                            <span className="font-medium text-neutral-700">Guests ({w.guests.length}): </span>
                            <span>{w.guests.map((g) => g.guest_name).join(', ')}</span>
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="pt-3 border-t border-black/[0.04] flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedWardForArrival(w)}
                          className="flex-1 py-2 px-3.5 bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-[0.99]"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Record Arrival</span>
                        </button>

                        <button
                          onClick={() => setSelectedWardForEdit(w)}
                          className="py-2 px-3 bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 font-medium text-xs rounded-xl transition-colors flex items-center gap-1"
                          title="Edit Division Details"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TABLE VIEW (Gate Attendance Only - Apple Style) */}
          {viewMode === 'table' && (
            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50/80 text-neutral-500 text-xs font-medium border-b border-black/[0.06]">
                      <th className="py-3 px-4">Division #</th>
                      <th className="py-3 px-4">Principal Invitee</th>
                      <th className="py-3 px-4">Party</th>
                      <th className="py-3 px-4 text-center">Allowance</th>
                      <th className="py-3 px-4 text-center">Entered</th>
                      <th className="py-3 px-4 text-center">Remaining / Excess</th>
                      <th className="py-3 px-4 text-center">Arrival Batches</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] text-xs sm:text-sm">
                    {filteredWards.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-neutral-500 font-normal">
                          No divisions match your search or filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredWards.map((w) => {
                        const isOver = w.total_entered > w.allowance;
                        return (
                          <tr
                            key={w.ward_number}
                            className={`hover:bg-neutral-50/60 transition-colors ${
                              isOver ? 'bg-rose-50/30' : ''
                            }`}
                          >
                            <td className="py-3 px-4 font-semibold text-neutral-900">
                              {w.ward_number >= 101 ? `Pass #${w.ward_number}` : `Division ${w.ward_number}`}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-medium text-neutral-900 block">{w.candidate_name}</span>
                              {w.phone ? (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <a
                                    href={`tel:${w.phone}`}
                                    className="text-xs text-neutral-500 hover:text-blue-600 font-mono"
                                    title="Click to Call"
                                  >
                                    {w.phone}
                                  </a>
                                  <WhatsAppButton ward={w} variant="icon" />
                                </div>
                              ) : (
                                <span className="text-[11px] text-neutral-400 italic block mt-0.5">No phone</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <PartyBadge party={w.party} size="sm" />
                            </td>
                            <td className="py-3 px-4 text-center font-medium text-neutral-600">
                              {w.allowance}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`font-semibold text-sm px-2.5 py-0.5 rounded-lg ${
                                  isOver
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                                    : w.total_entered > 0
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                                    : 'text-neutral-400'
                                }`}
                              >
                                {w.total_entered}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isOver ? (
                                <span className="font-medium text-rose-700 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded-lg text-xs">
                                  +{w.excess_count} Excess
                                </span>
                              ) : (
                                <span className="font-normal text-neutral-600">
                                  {w.remaining_allowance} Left
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center text-neutral-500 font-normal">
                              {w.recent_batches.filter((b) => !b.is_voided).length} batches
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedWardForArrival(w)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-2xs transition-all active:scale-[0.98]"
                                >
                                  Entry
                                </button>
                                <button
                                  onClick={() => setSelectedWardForEdit(w)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200/80 rounded-lg transition-colors"
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SEGMENT 2: FOOD & CATERING PLANNING ONLY (APPLE STYLE) */}
      {/* ========================================================================= */}
      {activeTab === 'food' && (
        <div className="flex flex-col gap-5">
          {/* AJAX Search & Food Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* AJAX Search Input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Instant AJAX search: type division #, candidate, party, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-neutral-50/80 focus:bg-white border border-neutral-200 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 rounded-xl transition-all text-neutral-900 outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 p-0.5"
                    title="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filter Dropdowns */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Scope Filter */}
                <select
                  value={scopeFilter}
                  onChange={(e) => setScopeFilter(e.target.value as 'WINNERS' | 'SPECIAL' | 'ALL')}
                  className="px-3.5 py-2 text-xs font-semibold border border-amber-300 rounded-xl bg-amber-50/80 text-amber-900 focus:border-amber-600 focus:outline-none transition-colors"
                >
                  <option value="WINNERS">Winning Corporators (64)</option>
                  <option value="SPECIAL">Special Guests & VIPs</option>
                  <option value="ALL">All Invitees & Divisions</option>
                </select>

                {/* Party Filter */}
                <select
                  value={partyFilter}
                  onChange={(e) => setPartyFilter(e.target.value)}
                  className="px-3.5 py-2 text-xs font-medium border border-neutral-200 rounded-xl bg-neutral-50/80 text-neutral-800 focus:border-neutral-900 focus:outline-none transition-colors"
                >
                  <option value="ALL">All Categories</option>
                  <option value="TDP">TDP</option>
                  <option value="JSP">JSP</option>
                  <option value="BJP">BJP</option>
                  <option value="VIP">VIP Invitees</option>
                  <option value="SPECIAL">Special Guests</option>
                  <option value="ALLIANCE">Alliance Leaders</option>
                </select>

                {/* Food Status Filter */}
                <select
                  value={foodFilter}
                  onChange={(e) => setFoodFilter(e.target.value)}
                  className="px-3.5 py-2 text-xs font-medium border border-neutral-200 rounded-xl bg-neutral-50/80 text-neutral-800 focus:border-neutral-900 focus:outline-none transition-colors"
                >
                  <option value="ALL">All Food Status</option>
                  <option value="CONFIRMED">Confirmed Only</option>
                  <option value="UNCONFIRMED">Unconfirmed Only</option>
                  <option value="UNSET">Unset (No counts yet)</option>
                  <option value="MISMATCH">⚠️ Mismatch with 5 Allowance</option>
                </select>

                {(searchQuery || partyFilter !== 'ALL' || foodFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setPartyFilter('ALL');
                      setFoodFilter('ALL');
                    }}
                    className="px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Quick Result Counter */}
            <div className="flex items-center justify-between text-xs text-neutral-400 pt-1 border-t border-black/[0.04]">
              <span>
                Showing <strong className="text-neutral-700 font-semibold">{filteredWards.length}</strong> of {activeScopeWards.length} catering targets
                {searchQuery && ` matching "${searchQuery}"`}
              </span>
              <span className="hidden sm:inline">Baseline: 5 plates per division invitation</span>
            </div>
          </div>

          {/* CARD STYLE VIEW (Food Planning Only - Apple Style) */}
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredWards.length === 0 ? (
                <div className="col-span-full bg-white rounded-2xl p-12 text-center text-neutral-500 border border-black/[0.06]">
                  <Utensils className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                  <p className="font-semibold text-base text-neutral-800">No catering records match your search</p>
                  <p className="text-xs text-neutral-400 mt-1">Try resetting your filters or typing another division number.</p>
                </div>
              ) : (
                filteredWards.map((w) => {
                  const hasFoodSet = w.expected_veg !== null || w.expected_non_veg !== null;
                  const totalFood = (w.expected_veg || 0) + (w.expected_non_veg || 0);
                  const isMismatch = hasFoodSet && totalFood !== w.allowance;

                  return (
                    <div
                      key={w.ward_number}
                      className={`bg-white rounded-2xl p-5 border transition-all shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] flex flex-col justify-between ${
                        isMismatch
                          ? 'border-amber-200/80 bg-amber-50/15'
                          : 'border-black/[0.06]'
                      }`}
                    >
                      {/* Card Header */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm border shadow-2xs ${
                                w.party === 'TDP'
                                  ? 'bg-[#FFF6CC] text-[#7A5B00] border-[#FFCC00]/40'
                                  : w.party === 'JSP'
                                  ? 'bg-[#FFEBEA] text-[#D70015] border-[#FF3B30]/30'
                                  : w.party === 'BJP'
                                  ? 'bg-[#FFF1E5] text-[#C93400] border-[#FF9500]/30'
                                  : 'bg-purple-100 text-purple-800 border-purple-200'
                              }`}
                            >
                              {w.ward_number}
                            </span>
                            <div>
                              <span className="text-xs text-neutral-400 font-medium block">
                                {w.ward_number >= 101 ? 'VIP / Special Pass' : `Division ${w.ward_number}`}
                              </span>
                              <h3 className="font-semibold text-base text-neutral-900 leading-snug tracking-tight">
                                {w.candidate_name}
                              </h3>
                            </div>
                          </div>
                          <PartyBadge party={w.party} size="sm" />
                        </div>

                        {/* Phone & WhatsApp */}
                        {w.phone && (
                          <div className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-xl bg-neutral-50 border border-neutral-200/70 mb-3.5 text-xs">
                            <a
                              href={`tel:${w.phone}`}
                              className="flex items-center gap-1.5 text-neutral-700 hover:text-blue-600 font-medium transition-colors font-mono"
                              title="Click to Call"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Phone className="w-3.5 h-3.5 text-neutral-400" />
                              <span>{w.phone}</span>
                            </a>
                            <WhatsAppButton ward={w} variant="pill" />
                          </div>
                        )}

                        {/* Food Details Box */}
                        <div className="bg-neutral-50/80 rounded-xl p-3.5 mb-3.5 border border-black/[0.04]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-neutral-700 flex items-center gap-1.5">
                              <Utensils className="w-3.5 h-3.5 text-neutral-500" />
                              <span>Catering Preferences</span>
                            </span>
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                w.food_confirmed
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200/60'
                              }`}
                            >
                              {w.food_confirmed ? 'Confirmed' : 'Unconfirmed'}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center py-2 bg-white rounded-xl border border-black/[0.04] mb-2">
                            <div>
                              <span className="text-[10px] text-neutral-400 block font-medium">Veg</span>
                              <span className="text-base font-semibold text-emerald-700">
                                {w.expected_veg !== null ? w.expected_veg : '—'}
                              </span>
                            </div>
                            <div className="border-x border-black/[0.04]">
                              <span className="text-[10px] text-neutral-400 block font-medium">Non-Veg</span>
                              <span className="text-base font-semibold text-amber-700">
                                {w.expected_non_veg !== null ? w.expected_non_veg : '—'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-neutral-400 block font-medium">Total</span>
                              <span className="text-base font-semibold text-neutral-900">
                                {hasFoodSet ? totalFood : '—'}
                              </span>
                            </div>
                          </div>

                          {/* Allowance Mismatch Flag */}
                          {isMismatch && (
                            <div className="text-xs p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 font-medium flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>
                                Planned total ({totalFood}) does not match the 5-person allowance.
                              </span>
                            </div>
                          )}

                          {!hasFoodSet && (
                            <p className="text-xs text-neutral-400 italic text-center py-1 font-normal">
                              Food counts have not been entered yet.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Card Action Button: Update Food */}
                      <div className="pt-3 border-t border-black/[0.04] flex items-center justify-end">
                        <button
                          onClick={() => setSelectedWardForEdit(w)}
                          className="w-full py-2 px-3.5 bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-[0.99]"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Update Food Planning</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TABLE VIEW (Food Planning Only - Apple Style) */}
          {viewMode === 'table' && (
            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50/80 text-neutral-500 text-xs font-medium border-b border-black/[0.06]">
                      <th className="py-3 px-4">Division #</th>
                      <th className="py-3 px-4">Principal Invitee</th>
                      <th className="py-3 px-4">Party</th>
                      <th className="py-3 px-4 text-center">Allowance</th>
                      <th className="py-3 px-4 text-center">Expected Veg</th>
                      <th className="py-3 px-4 text-center">Expected Non-Veg</th>
                      <th className="py-3 px-4 text-center">Total Planned</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Allowance Check</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] text-xs sm:text-sm">
                    {filteredWards.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-neutral-500 font-normal">
                          No catering records match your search or filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredWards.map((w) => {
                        const hasFoodSet = w.expected_veg !== null || w.expected_non_veg !== null;
                        const totalFood = (w.expected_veg || 0) + (w.expected_non_veg || 0);
                        const isMismatch = hasFoodSet && totalFood !== w.allowance;

                        return (
                          <tr
                            key={w.ward_number}
                            className={`hover:bg-neutral-50/60 transition-colors ${
                              isMismatch ? 'bg-amber-50/20' : ''
                            }`}
                          >
                            <td className="py-3 px-4 font-semibold text-neutral-900">
                              {w.ward_number >= 101 ? `Pass #${w.ward_number}` : `Division ${w.ward_number}`}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-medium text-neutral-900 block">{w.candidate_name}</span>
                              {w.phone && (
                                <span className="text-xs text-neutral-400 block font-mono mt-0.5">{w.phone}</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <PartyBadge party={w.party} size="sm" />
                            </td>
                            <td className="py-3 px-4 text-center font-medium text-neutral-600">
                              {w.allowance}
                            </td>
                            <td className="py-3 px-4 text-center font-medium text-emerald-700">
                              {w.expected_veg !== null ? w.expected_veg : <span className="text-neutral-400 font-normal">Unset</span>}
                            </td>
                            <td className="py-3 px-4 text-center font-medium text-amber-700">
                              {w.expected_non_veg !== null ? w.expected_non_veg : <span className="text-neutral-400 font-normal">Unset</span>}
                            </td>
                            <td className="py-3 px-4 text-center font-semibold text-neutral-900">
                              {hasFoodSet ? totalFood : <span className="text-neutral-400 font-normal">Unset</span>}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                                  w.food_confirmed
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200/60'
                                }`}
                              >
                                {w.food_confirmed ? 'Confirmed' : 'Unconfirmed'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isMismatch ? (
                                <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200/60 text-amber-900 text-xs font-medium inline-flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  <span>Mismatch ({totalFood}/5)</span>
                                </span>
                              ) : hasFoodSet ? (
                                <span className="text-emerald-700 text-xs font-medium flex items-center justify-center gap-1">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Matched</span>
                                </span>
                              ) : (
                                <span className="text-neutral-400 text-xs font-normal">Pending</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => setSelectedWardForEdit(w)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-all active:scale-[0.98]"
                              >
                                Edit Food
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ENTRY HISTORY & VOIDING (APPLE STYLE) */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="flex flex-col gap-5">
          <div className="bg-white p-5 rounded-2xl border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base text-neutral-900">Attendance Entry History</h3>
              <p className="text-xs text-neutral-500 mt-0.5 font-normal">
                All gate entry batches recorded across all staff devices. Admins can void mistaken records with full audit trail.
              </p>
            </div>
            <a
              href="/api/export/entries"
              download
              className="px-3.5 py-1.5 bg-neutral-900 text-white rounded-xl text-xs font-medium shadow-xs hover:bg-neutral-800 transition-all flex items-center gap-1.5 active:scale-[0.98]"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-neutral-300" />
              <span>Download CSV</span>
            </a>
          </div>

          <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 text-neutral-500 text-xs font-medium border-b border-black/[0.06]">
                    <th className="py-3 px-4">Division #</th>
                    <th className="py-3 px-4">Batch Size</th>
                    <th className="py-3 px-4">Time (IST)</th>
                    <th className="py-3 px-4">Recorded By</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] text-xs sm:text-sm">
                  {recentBatches.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-neutral-500 font-normal">
                        No arrivals have been recorded yet.
                      </td>
                    </tr>
                  ) : (
                    recentBatches.map((batch) => (
                      <tr
                        key={batch.id}
                        className={`hover:bg-neutral-50/60 transition-colors ${
                          batch.is_voided ? 'bg-neutral-50/80 opacity-60' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-semibold text-neutral-900">
                          Division {batch.ward_id}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-semibold text-xs sm:text-sm px-2.5 py-1 rounded-lg ${
                              batch.is_voided
                                ? 'bg-neutral-200 text-neutral-600 line-through'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                            }`}
                          >
                            +{batch.batch_size} {batch.batch_size === 1 ? 'person' : 'people'}
                          </span>
                          {batch.excess_acknowledged && (
                            <span className="ml-2 text-[10px] text-amber-800 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded-md font-medium">
                              Excess Ack
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-neutral-600 font-normal">
                          {formatInKolkataTime(batch.created_at, { includeTime: true })}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-neutral-800 block">
                            {batch.recorded_by_name || 'Staff User'}
                          </span>
                          {batch.recorded_by_email && (
                            <span className="text-xs text-neutral-400 block mt-0.5">{batch.recorded_by_email}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {batch.is_voided ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200/60">
                                Voided
                              </span>
                              {batch.void_reason && (
                                <span className="text-[10px] text-neutral-400 mt-0.5 italic">
                                  &quot;{batch.void_reason}&quot;
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                              Valid Entry
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {!batch.is_voided && (
                            <button
                              onClick={() => {
                                setBatchToVoid(batch);
                                setVoidReason('');
                                setVoidError(null);
                              }}
                              className="px-3 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/70 rounded-lg transition-colors"
                            >
                              Void Entry
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: AUDIT TRAIL (APPLE STYLE) */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="flex flex-col gap-5">
          <div className="bg-white p-5 rounded-2xl border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <h3 className="font-semibold text-base text-neutral-900">System Audit Trail</h3>
            <p className="text-xs text-neutral-500 mt-0.5 font-normal">
              Immutable historical logs of all administrative modifications, food adjustments, and voided batches.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 text-neutral-500 text-xs font-medium border-b border-black/[0.06]">
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Entity</th>
                    <th className="py-3 px-4">Record ID</th>
                    <th className="py-3 px-4">Reason / Notes</th>
                    <th className="py-3 px-4">Timestamp (IST)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] text-xs sm:text-sm">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-neutral-500 font-normal">
                        No audit records logged yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-neutral-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <span
                            className={`font-medium text-xs px-2.5 py-0.5 rounded-full ${
                              log.action === 'VOID_BATCH'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                                : log.action === 'INSERT'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                                : 'bg-neutral-100 text-neutral-800 border border-neutral-200'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-neutral-700">
                          {log.table_name}
                        </td>
                        <td className="py-3 px-4 font-mono text-neutral-500">
                          {log.record_id}
                        </td>
                        <td className="py-3 px-4 text-neutral-700">
                          {log.reason || 'Standard update'}
                        </td>
                        <td className="py-3 px-4 text-neutral-500 font-normal">
                          {formatInKolkataTime(log.created_at, { includeTime: true })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: INVITATIONS & QR PASSES (65 WINNING CORPORATORS) */}
      {/* ========================================================================= */}
      {activeTab === 'invitations' && (
        <InvitationsSection />
      )}

      {/* ADMIN WARD EDIT MODAL */}
      {selectedWardForEdit && (
        <AdminWardEditModal
          ward={selectedWardForEdit}
          onClose={() => setSelectedWardForEdit(null)}
          onSaved={() => {
            setSelectedWardForEdit(null);
            loadDashboardData();
          }}
          onDeleted={(deletedNum) => {
            setSelectedWardForEdit(null);
            setWards((prev) => prev.filter((w) => w.ward_number !== deletedNum));
            loadDashboardData();
          }}
        />
      )}

      {/* ADD SPECIAL GUEST / VIP MODAL */}
      {isAddSpecialGuestOpen && (
        <AddSpecialGuestModal
          onClose={() => setIsAddSpecialGuestOpen(false)}
          onCreated={(newWard) => {
            setIsAddSpecialGuestOpen(false);
            setWards((prev) => [newWard, ...prev.filter((w) => w.ward_number !== newWard.ward_number)]);
            loadDashboardData();
          }}
        />
      )}

      {/* VOID CONFIRMATION MODAL (APPLE STYLE) */}
      {batchToVoid && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)] border border-black/[0.06]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <span>Void Entry Batch</span>
              </h3>
              <button
                onClick={() => setBatchToVoid(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <p className="text-xs sm:text-sm text-neutral-700">
                You are about to void the entry of{' '}
                <span className="font-semibold text-neutral-900">+{batchToVoid.batch_size} people</span> for{' '}
                <span className="font-semibold text-neutral-900">Division {batchToVoid.ward_id}</span> recorded at{' '}
                {formatInKolkataTime(batchToVoid.created_at)}.
              </p>

              <p className="text-xs text-neutral-400 font-normal">
                Voiding will exclude these people from the attendance total while preserving the record and audit trail.
              </p>

              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                  Reason for Voiding *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Scanned wrong division invitation, double scanned by error..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-neutral-50/80 focus:bg-white border border-neutral-200 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 rounded-xl transition-all text-neutral-900 outline-none"
                />
              </div>

              {voidError && (
                <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{voidError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setBatchToVoid(null)}
                  disabled={voiding}
                  className="px-4 py-2 border border-neutral-200 bg-white hover:bg-neutral-50 rounded-xl text-xs sm:text-sm font-medium text-neutral-700 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmVoid}
                  disabled={voiding}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-[0.99]"
                >
                  {voiding ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <span>Confirm Void</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INSTANT RECORD ARRIVAL MODAL (0ms response - Apple Style) */}
      {selectedWardForArrival && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg relative my-auto">
            <button
              onClick={() => {
                setSelectedWardForArrival(null);
                loadDashboardData(true);
              }}
              className="mb-2.5 ml-auto text-neutral-700 hover:text-neutral-950 font-medium text-xs flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-black/[0.08] shadow-sm transition-all active:scale-[0.98]"
            >
              <X className="w-3.5 h-3.5" />
              <span>Close Window</span>
            </button>
            <WardEntryCard
              wardNumber={selectedWardForArrival.ward_number}
              initialWardData={selectedWardForArrival}
              isAdmin={true}
              onScanNext={() => {
                setSelectedWardForArrival(null);
                loadDashboardData(true);
              }}
            />
          </div>
        </div>
      )}

      {/* MOBILE OPTIONS & HAMBURGER DRAWER (APPLE SHEET) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex flex-col justify-end sm:hidden">
          {/* Backdrop tap to close */}
          <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />

          <div className="bg-white rounded-t-3xl p-6 shadow-[0_-12px_40px_rgba(0,0,0,0.15)] border-t border-black/[0.06] max-h-[85vh] overflow-y-auto flex flex-col gap-5">
            {/* Grabber handle */}
            <div className="w-10 h-1 bg-neutral-200 rounded-full mx-auto -mt-2 mb-1" />

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-neutral-900 tracking-tight">Dashboard Controls</h3>
                <p className="text-xs text-neutral-400 mt-0.5">Switch operations, layout, or export reports</p>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Section 1: Operational Segment */}
            <div>
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
                Operations Segment
              </span>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('entries');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center justify-between p-3 rounded-2xl transition-all ${
                    activeTab === 'entries'
                      ? 'bg-neutral-900 text-white font-medium shadow-xs'
                      : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Users className="w-4 h-4" />
                    <span className="text-xs font-semibold">Gate Entries & Attendance</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'entries' ? 'bg-white/20 text-white' : 'bg-neutral-200/70 text-neutral-600'}`}>
                    {wards.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('food');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center justify-between p-3 rounded-2xl transition-all ${
                    activeTab === 'food'
                      ? 'bg-neutral-900 text-white font-medium shadow-xs'
                      : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Utensils className="w-4 h-4" />
                    <span className="text-xs font-semibold">Food & Catering Planning</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'food' ? 'bg-white/20 text-white' : 'bg-neutral-200/70 text-neutral-600'}`}>
                    {wards.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('history');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center justify-between p-3 rounded-2xl transition-all ${
                    activeTab === 'history'
                      ? 'bg-neutral-900 text-white font-medium shadow-xs'
                      : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <History className="w-4 h-4" />
                    <span className="text-xs font-semibold">Attendance Entry History</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'history' ? 'bg-white/20 text-white' : 'bg-neutral-200/70 text-neutral-600'}`}>
                    {recentBatches.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('audit');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center justify-between p-3 rounded-2xl transition-all ${
                    activeTab === 'audit'
                      ? 'bg-neutral-900 text-white font-medium shadow-xs'
                      : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-xs font-semibold">System Audit Trail</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-40" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('invitations');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center justify-between p-3 rounded-2xl transition-all ${
                    activeTab === 'invitations'
                      ? 'bg-neutral-900 text-white font-medium shadow-xs'
                      : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-semibold">Invitations & QR Passes</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'invitations' ? 'bg-white/20 text-white' : 'bg-neutral-200/70 text-neutral-600'}`}>
                    65
                  </span>
                </button>
              </div>
            </div>

            {/* Section 2: View Style (for Entries & Food) */}
            {(activeTab === 'entries' || activeTab === 'food') && (
              <div>
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
                  Display Layout
                </span>
                <div className="grid grid-cols-2 gap-2 bg-neutral-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('cards');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-xl transition-all ${
                      viewMode === 'cards'
                        ? 'bg-white text-neutral-900 font-semibold shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Cards Style</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('table');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-xl transition-all ${
                      viewMode === 'table'
                        ? 'bg-white text-neutral-900 font-semibold shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    <span>Table Style</span>
                  </button>
                </div>
              </div>
            )}

            {/* Section 3: Tools & Export Actions */}
            <div>
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
                Tools & Reports
              </span>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsAddSpecialGuestOpen(true);
                  }}
                  className="flex items-center justify-between p-3 rounded-2xl bg-purple-50 hover:bg-purple-100 text-purple-900 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <UserPlus className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-semibold">+ Add Special Guest / VIP</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-purple-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsSettingsOpen(true);
                  }}
                  className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50 hover:bg-neutral-100 text-neutral-800 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Settings className="w-4 h-4 text-neutral-500" />
                    <span className="text-xs font-medium">WhatsApp Message Settings</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                </button>

                <a
                  href="/api/export/wards"
                  download
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50 hover:bg-neutral-100 text-neutral-800 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-medium">Export Division Summary (CSV)</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                </a>

                <a
                  href="/api/export/entries"
                  download
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50 hover:bg-neutral-100 text-neutral-800 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <History className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-medium">Export Entry History (CSV)</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    loadDashboardData();
                    setIsMobileMenuOpen(false);
                  }}
                  disabled={refreshing}
                  className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50 hover:bg-neutral-100 text-neutral-800 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <RefreshCw className={`w-4 h-4 text-neutral-500 ${refreshing ? 'animate-spin text-neutral-900' : ''}`} />
                    <span className="text-xs font-medium">Refresh Dashboard Totals</span>
                  </div>
                  <span className="text-[10px] text-neutral-400">
                    {lastRefreshed ? formatInKolkataTime(lastRefreshed, { includeTime: true }) : 'Syncing...'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP & MESSAGE PATTERN SETTINGS MODAL */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
