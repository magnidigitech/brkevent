'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  UserCheck
} from 'lucide-react';
import { WardWithStats, ArrivalBatch, DashboardSummary } from '@/types/database';
import { PartyBadge } from '@/components/PartyBadge';
import { AdminWardEditModal } from '@/components/AdminWardEditModal';
import { formatInKolkataTime } from '@/lib/utils/date';

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [wards, setWards] = useState<WardWithStats[]>([]);
  const [recentBatches, setRecentBatches] = useState<ArrivalBatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  // Active Tab: 'wards' | 'history' | 'audit'
  const [activeTab, setActiveTab] = useState<'wards' | 'history' | 'audit'>('wards');

  // Display Mode: 'cards' (default mobile friendly) | 'table'
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // AJAX Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [partyFilter, setPartyFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL'); // 'ALL' | 'ARRIVED' | 'NOT_ARRIVED' | 'OVER_ALLOWANCE'
  const [foodFilter, setFoodFilter] = useState<string>('ALL'); // 'ALL' | 'CONFIRMED' | 'UNCONFIRMED'

  // Admin Ward Edit Modal State
  const [selectedWardForEdit, setSelectedWardForEdit] = useState<WardWithStats | null>(null);

  // Void Batch Modal State
  const [batchToVoid, setBatchToVoid] = useState<ArrivalBatch | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');
  const [voiding, setVoiding] = useState<boolean>(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Load Dashboard Data
  const loadDashboardData = useCallback(async (isBackground: boolean = false) => {
    try {
      if (!isBackground) setRefreshing(true);

      const [dashRes, wardsRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/wards'),
      ]);

      const dashData = await dashRes.json();
      const wardsData = await wardsRes.json();

      if (dashData.success) {
        setSummary(dashData.summary);
        setRecentBatches(dashData.recent_batches || []);
      }

      if (wardsData.success) {
        setWards(wardsData.wards || []);
      }

      setLastRefreshed(new Date().toISOString());
    } catch (err) {
      console.error('Failed to refresh dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Periodic polling every 12 seconds for reliable multi-device sync
  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(() => {
      loadDashboardData(true);
    }, 12000);
    return () => clearInterval(interval);
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

  // Instant AJAX Filter Wards
  const filteredWards = wards.filter((w) => {
    // Search query matches ward number, candidate name, party, phone, or guest names
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const matchWardNo = w.ward_number.toString() === q || `ward ${w.ward_number}`.includes(q);
      const matchName = w.candidate_name.toLowerCase().includes(q);
      const matchParty = w.party.toLowerCase().includes(q);
      const matchPhone = w.phone ? w.phone.toLowerCase().includes(q) : false;
      const matchGuests = w.guests?.some((g) => g.guest_name.toLowerCase().includes(q));
      if (!matchWardNo && !matchName && !matchParty && !matchPhone && !matchGuests) return false;
    }

    // Party filter
    if (partyFilter !== 'ALL' && w.party !== partyFilter) {
      return false;
    }

    // Attendance status filter
    if (statusFilter === 'ARRIVED' && w.total_entered === 0) return false;
    if (statusFilter === 'NOT_ARRIVED' && w.total_entered > 0) return false;
    if (statusFilter === 'OVER_ALLOWANCE' && w.total_entered <= w.allowance) return false;

    // Food filter
    if (foodFilter === 'CONFIRMED' && !w.food_confirmed) return false;
    if (foodFilter === 'UNCONFIRMED' && w.food_confirmed) return false;

    return true;
  });

  return (
    <div className="flex-1 py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      {/* Top Header & Realtime Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block">
            Command Center
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Event Operations Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Realtime attendance tracking, allowance auditing, and catering totals for all 76 wards.
          </p>
        </div>

        {/* Sync Status & Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 shadow-2xs">
            <RefreshCw className={`w-3.5 h-3.5 text-amber-500 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden xs:inline">Refreshed:</span>
            <span>{lastRefreshed ? formatInKolkataTime(lastRefreshed, { includeTime: true }) : 'Syncing...'}</span>
          </div>

          <button
            onClick={() => loadDashboardData()}
            disabled={refreshing}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-700 shadow-2xs transition"
            title="Refresh Totals"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-600' : ''}`} />
          </button>

          {/* CSV Export Buttons */}
          <a
            href="/api/export/wards"
            download
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
            title="Export Ward Summary CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Wards</span>
            <span className="sm:hidden">Wards</span>
          </a>

          <a
            href="/api/export/entries"
            download
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition"
            title="Export Entry History CSV"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Entries</span>
            <span className="sm:hidden">Entries</span>
          </a>
        </div>
      </div>

      {/* METRIC STAT CARDS */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {/* Total People Entered */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider">Total Entered</span>
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
            </div>
            <div className="mt-2 sm:mt-3">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">{summary.total_entered}</span>
              <span className="text-[11px] sm:text-xs text-slate-500 ml-1.5">/ {summary.normal_total_allowance} cap</span>
            </div>
            <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (summary.total_entered / summary.normal_total_allowance) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Wards Attendance Progress */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider">Wards Arrived</span>
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">{summary.wards_with_arrivals}</span>
              <span className="text-[11px] sm:text-xs text-slate-500">/ 76 Wards</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              <span className="font-semibold text-slate-700">{summary.wards_without_arrivals}</span> pending
            </p>
          </div>

          {/* Excess People & Wards */}
          <div className={`rounded-2xl p-4 sm:p-5 border shadow-xs flex flex-col justify-between ${
            summary.wards_exceeding_allowance > 0 ? 'bg-rose-50/70 border-rose-200' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-rose-800">Excess Attendees</span>
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600" />
            </div>
            <div className="mt-2 sm:mt-3">
              <span className={`text-2xl sm:text-3xl font-black ${summary.total_excess_people > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                +{summary.total_excess_people}
              </span>
              <span className="text-[11px] sm:text-xs text-rose-800 ml-1.5">over 5/ward</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-2">
              <span className="font-semibold text-rose-700">{summary.wards_exceeding_allowance}</span> wards exceeding
            </p>
          </div>

          {/* Catering Totals */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider">Food Planning</span>
              <Utensils className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
            </div>
            <div className="mt-2 sm:mt-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-800 uppercase block">Veg</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-700">{summary.expected_veg_total}</span>
              </div>
              <div className="border-l border-slate-200 pl-3">
                <span className="text-[10px] font-bold text-amber-800 uppercase block">Non-Veg</span>
                <span className="text-xl sm:text-2xl font-black text-amber-700">{summary.expected_non_veg_total}</span>
              </div>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 mt-2">
              {summary.wards_unconfirmed_food} unconfirmed wards
            </p>
          </div>
        </div>
      )}

      {/* NAVIGATION TABS & VIEW TOGGLE */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 mb-6 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('wards')}
            className={`pb-2 px-3 text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'wards'
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Ward Directory ({wards.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2 px-3 text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Entry History ({recentBatches.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-2 px-3 text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Audit Trail</span>
          </button>
        </div>

        {/* View Style Switcher: Cards vs Table */}
        {activeTab === 'wards' && (
          <div className="flex items-center gap-1 self-end sm:self-auto bg-slate-200/70 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Card Style</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: WARD DIRECTORY */}
      {activeTab === 'wards' && (
        <div className="flex flex-col gap-4">
          {/* AJAX Search & Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* AJAX Search Input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Instant AJAX search: type ward #, candidate, party, phone, or guest..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-9 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    title="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filter Dropdowns */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Party Filter */}
                <select
                  value={partyFilter}
                  onChange={(e) => setPartyFilter(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="ALL">All Parties</option>
                  <option value="TDP">TDP (57)</option>
                  <option value="JSP">JSP (15)</option>
                  <option value="BJP">BJP (4)</option>
                </select>

                {/* Attendance Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="ALL">All Attendance</option>
                  <option value="ARRIVED">Arrived (&gt;0)</option>
                  <option value="NOT_ARRIVED">Not Arrived (0)</option>
                  <option value="OVER_ALLOWANCE">Over Allowance (&gt;5)</option>
                </select>

                {/* Food Status Filter */}
                <select
                  value={foodFilter}
                  onChange={(e) => setFoodFilter(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="ALL">All Food Status</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="UNCONFIRMED">Unconfirmed</option>
                </select>

                {(searchQuery || partyFilter !== 'ALL' || statusFilter !== 'ALL' || foodFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setPartyFilter('ALL');
                      setStatusFilter('ALL');
                      setFoodFilter('ALL');
                    }}
                    className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Quick Result Counter */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
              <span>
                Found <strong>{filteredWards.length}</strong> of {wards.length} wards
                {searchQuery && ` matching "${searchQuery}"`}
              </span>
              <span className="hidden sm:inline">5-person total allowance per ward</span>
            </div>
          </div>

          {/* CARD STYLE VIEW (Mobile-friendly default) */}
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredWards.length === 0 ? (
                <div className="col-span-full bg-white rounded-2xl p-10 text-center text-slate-500 border border-slate-200">
                  <Search className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-base text-slate-700">No wards match your search</p>
                  <p className="text-xs text-slate-400 mt-1">Try typing a different candidate name, party, or ward number.</p>
                </div>
              ) : (
                filteredWards.map((w) => {
                  const isOver = w.total_entered > w.allowance;
                  const isFull = w.total_entered === w.allowance;
                  return (
                    <div
                      key={w.ward_number}
                      className={`bg-white rounded-2xl p-5 border transition shadow-xs hover:shadow-md flex flex-col justify-between ${
                        isOver
                          ? 'border-rose-300 bg-rose-50/20'
                          : isFull
                          ? 'border-amber-300 bg-amber-50/10'
                          : 'border-slate-200'
                      }`}
                    >
                      {/* Card Header */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2.5">
                            <span className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-black text-base shadow-xs">
                              {w.ward_number}
                            </span>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Ward {w.ward_number}
                              </span>
                              <h3 className="font-bold text-base text-slate-900 leading-snug">
                                {w.candidate_name}
                              </h3>
                            </div>
                          </div>
                          <PartyBadge party={w.party} size="sm" />
                        </div>

                        {w.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{w.phone}</span>
                          </div>
                        )}

                        {/* Attendance Counter & Progress */}
                        <div className="bg-slate-50 rounded-xl p-3 mb-3 border border-slate-100">
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="font-bold text-slate-600">Gate Attendance</span>
                            <span className="font-bold text-slate-900">
                              <span className={`text-base font-black ${isOver ? 'text-rose-600' : 'text-slate-900'}`}>
                                {w.total_entered}
                              </span>{' '}
                              / {w.allowance} allowance
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                isOver ? 'bg-rose-600' : isFull ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, (w.total_entered / w.allowance) * 100)}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            {isOver ? (
                              <span className="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                                +{w.excess_count} Excess Attendees
                              </span>
                            ) : isFull ? (
                              <span className="font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                                Exact Capacity Reached
                              </span>
                            ) : (
                              <span className="text-slate-500 font-medium">
                                {w.remaining_allowance} slots remaining
                              </span>
                            )}

                            <span className="text-slate-400">
                              {w.recent_batches.filter((b) => !b.is_voided).length} arrival batches
                            </span>
                          </div>
                        </div>

                        {/* Food Planning Status */}
                        <div className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-100/70 mb-3">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Utensils className="w-3.5 h-3.5 text-slate-500" />
                            <span>
                              Veg: <strong>{w.expected_veg !== null ? w.expected_veg : '—'}</strong>, Non-veg:{' '}
                              <strong>{w.expected_non_veg !== null ? w.expected_non_veg : '—'}</strong>
                            </span>
                          </div>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              w.food_confirmed
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {w.food_confirmed ? 'Confirmed' : 'Unconfirmed'}
                          </span>
                        </div>

                        {/* Accompanying Guests Preview if any */}
                        {w.guests && w.guests.length > 0 && (
                          <div className="mb-3 text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-700">Guests ({w.guests.length}): </span>
                            <span>{w.guests.map((g) => g.guest_name).join(', ')}</span>
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <Link
                          href={`/ward${w.ward_number}`}
                          className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Record Arrival</span>
                        </Link>

                        <button
                          onClick={() => setSelectedWardForEdit(w)}
                          className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition flex items-center gap-1"
                          title="Edit Ward Details & Food Counts"
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

          {/* TABLE VIEW (Optional desktop view) */}
          {viewMode === 'table' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Ward #</th>
                      <th className="py-3 px-4">Principal Invitee</th>
                      <th className="py-3 px-4">Party</th>
                      <th className="py-3 px-4 text-center">Allowance</th>
                      <th className="py-3 px-4 text-center">Entered</th>
                      <th className="py-3 px-4 text-center">Remaining / Excess</th>
                      <th className="py-3 px-4 text-center">Expected Veg</th>
                      <th className="py-3 px-4 text-center">Expected Non-Veg</th>
                      <th className="py-3 px-4 text-center">Food Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                    {filteredWards.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-500">
                          No wards match your search or filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredWards.map((w) => {
                        const isOver = w.total_entered > w.allowance;
                        return (
                          <tr
                            key={w.ward_number}
                            className={`hover:bg-slate-50/80 transition ${
                              isOver ? 'bg-rose-50/40' : ''
                            }`}
                          >
                            <td className="py-3 px-4 font-black text-slate-900">
                              Ward {w.ward_number}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-800 block">{w.candidate_name}</span>
                              {w.phone && (
                                <span className="text-[11px] text-slate-400 block">{w.phone}</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <PartyBadge party={w.party} size="sm" />
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-slate-600">
                              {w.allowance}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`font-black text-sm px-2 py-0.5 rounded-lg ${
                                  isOver
                                    ? 'bg-rose-100 text-rose-800'
                                    : w.total_entered > 0
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'text-slate-400'
                                }`}
                              >
                                {w.total_entered}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isOver ? (
                                <span className="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-lg text-xs">
                                  +{w.excess_count} Excess
                                </span>
                              ) : (
                                <span className="font-medium text-slate-700">
                                  {w.remaining_allowance} Left
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center font-semibold text-slate-700">
                              {w.expected_veg !== null ? w.expected_veg : <span className="text-slate-400 font-normal">Unset</span>}
                            </td>
                            <td className="py-3 px-4 text-center font-semibold text-slate-700">
                              {w.expected_non_veg !== null ? w.expected_non_veg : <span className="text-slate-400 font-normal">Unset</span>}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  w.food_confirmed
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {w.food_confirmed ? 'Confirmed' : 'Unconfirmed'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Link
                                  href={`/ward${w.ward_number}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-slate-900 bg-amber-500 hover:bg-amber-400 rounded-lg transition"
                                >
                                  Entry
                                </Link>
                                <button
                                  onClick={() => setSelectedWardForEdit(w)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition"
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

      {/* TAB 2: ENTRY HISTORY & VOIDING (Card Style on Mobile, Responsive) */}
      {activeTab === 'history' && (
        <div className="flex flex-col gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900">Attendance Entry History</h3>
              <p className="text-xs text-slate-500">
                Timestamped records of each entry batch. Admins can void mistaken records with audit trail.
              </p>
            </div>
            <a
              href="/api/export/entries"
              download
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </a>
          </div>

          {/* Cards for Entry History */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentBatches.length === 0 ? (
              <div className="col-span-full bg-white rounded-2xl p-10 text-center text-slate-500 border border-slate-200">
                No attendance arrivals recorded yet today.
              </div>
            ) : (
              recentBatches.map((batch) => {
                const ward = wards.find((x) => x.ward_number === batch.ward_id);
                return (
                  <div
                    key={batch.id}
                    className={`bg-white rounded-2xl p-4 border transition flex flex-col justify-between ${
                      batch.is_voided
                        ? 'border-slate-200 bg-slate-100/70 opacity-60'
                        : 'border-slate-200 shadow-2xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-black text-sm flex items-center justify-center">
                            W-{batch.ward_id}
                          </span>
                          <div>
                            <span className="font-bold text-sm text-slate-900 block leading-tight">
                              Ward {batch.ward_id}
                            </span>
                            <span className="text-xs text-slate-500">
                              {ward?.candidate_name || `Ward ${batch.ward_id}`}
                            </span>
                          </div>
                        </div>

                        <span className="text-base font-black px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900">
                          +{batch.batch_size}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 space-y-1 mb-3 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatInKolkataTime(batch.created_at)}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          By: <strong className="text-slate-600">{batch.recorded_by_name || 'Staff User'}</strong>
                        </div>
                      </div>

                      {batch.excess_acknowledged && (
                        <div className="mb-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                            Excess Acknowledged (+{batch.excess_count})
                          </span>
                        </div>
                      )}

                      {batch.is_voided && (
                        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 mb-2">
                          <span className="font-bold">Voided: </span>
                          <span>{batch.void_reason || 'Incorrect entry'}</span>
                        </div>
                      )}
                    </div>

                    {!batch.is_voided && (
                      <div className="pt-2 border-t border-slate-100 flex justify-end">
                        <button
                          onClick={() => {
                            setBatchToVoid(batch);
                            setVoidReason('');
                            setVoidError(null);
                          }}
                          className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition"
                        >
                          Void Batch
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT TRAIL LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-bold text-base text-slate-900">Audit Trail History</h3>
            <p className="text-xs text-slate-500">
              Immutable audit log of all arrivals, void corrections, and administrative updates.
            </p>
          </div>

          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                No audit log entries recorded yet.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-4 flex items-start justify-between text-xs sm:text-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${
                        log.action === 'VOID'
                          ? 'bg-rose-100 text-rose-800'
                          : log.action === 'UPDATE'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {log.action}
                      </span>
                      <span className="font-bold text-slate-800">
                        {log.table_name} (#{log.record_id})
                      </span>
                    </div>
                    {log.reason && (
                      <p className="text-slate-700 mt-1 font-medium">
                        Reason / Note: &ldquo;{log.reason}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <span>{formatInKolkataTime(log.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
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
        />
      )}

      {/* VOID CONFIRMATION MODAL */}
      {batchToVoid && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-rose-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-300" />
                <h3 className="font-bold text-base">Void Arrival Batch</h3>
              </div>
              <button
                onClick={() => setBatchToVoid(null)}
                className="text-rose-200 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <p className="text-xs sm:text-sm text-slate-700">
                You are about to void the entry of{' '}
                <span className="font-bold">+{batchToVoid.batch_size} people</span> for{' '}
                <span className="font-bold">Ward {batchToVoid.ward_id}</span> recorded at{' '}
                {formatInKolkataTime(batchToVoid.created_at)}.
              </p>

              <p className="text-xs text-slate-500">
                Voiding will exclude these people from the attendance total while preserving the record and audit trail.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Reason for Voiding *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Scanned wrong ward invitation, double scanned by error..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {voidError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{voidError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBatchToVoid(null)}
                  disabled={voiding}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmVoid}
                  disabled={voiding}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition flex items-center gap-1.5"
                >
                  {voiding ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Confirm Void</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
