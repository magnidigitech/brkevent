'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Building2,
  AlertTriangle,
  Utensils,
  Download,
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
  AlertCircle
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

  // Search & Filters
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

  // Filter Wards
  const filteredWards = wards.filter((w) => {
    // Search query
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const matchWardNo = w.ward_number.toString() === q;
      const matchName = w.candidate_name.toLowerCase().includes(q);
      const matchParty = w.party.toLowerCase().includes(q);
      if (!matchWardNo && !matchName && !matchParty) return false;
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
    <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
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
            <span>Refreshed: {lastRefreshed ? formatInKolkataTime(lastRefreshed, { includeTime: true }) : 'Syncing...'}</span>
          </div>

          <button
            onClick={() => loadDashboardData()}
            disabled={refreshing}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-700 shadow-2xs transition"
            title="Refresh Totals"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-600' : ''}`} />
          </button>

          {/* CSV Export Dropdown / Buttons */}
          <a
            href="/api/export/wards"
            download
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
            title="Export Ward Summary CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Wards CSV</span>
          </a>

          <a
            href="/api/export/entries"
            download
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition"
            title="Export Entry History CSV"
          >
            <History className="w-3.5 h-3.5" />
            <span>Export Entries CSV</span>
          </a>
        </div>
      </div>

      {/* METRIC STAT CARDS */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {/* Total People Entered */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Total People Entered</span>
              <Users className="w-5 h-5 text-amber-600" />
            </div>
            <div className="mt-3">
              <span className="text-3xl font-black text-slate-900">{summary.total_entered}</span>
              <span className="text-xs text-slate-500 ml-2">/ {summary.normal_total_allowance} normal capacity</span>
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
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Ward Arrivals</span>
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">{summary.wards_with_arrivals}</span>
              <span className="text-xs text-slate-500">/ 76 Wards arrived</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              <span className="font-semibold text-slate-700">{summary.wards_without_arrivals}</span> wards pending arrival
            </p>
          </div>

          {/* Excess People & Wards */}
          <div className={`rounded-2xl p-5 border shadow-xs flex flex-col justify-between ${
            summary.wards_exceeding_allowance > 0 ? 'bg-rose-50/70 border-rose-200' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-800">Excess Attendees</span>
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div className="mt-3">
              <span className={`text-3xl font-black ${summary.total_excess_people > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                +{summary.total_excess_people}
              </span>
              <span className="text-xs text-rose-800 ml-2">people over 5-person allowance</span>
            </div>
            <p className="text-xs text-slate-600 mt-2">
              <span className="font-semibold text-rose-700">{summary.wards_exceeding_allowance}</span> wards exceeding allowance
            </p>
          </div>

          {/* Catering Totals */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Expected Food Planning</span>
              <Utensils className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-800 uppercase block">Veg Total</span>
                <span className="text-2xl font-black text-emerald-700">{summary.expected_veg_total}</span>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <span className="text-xs font-bold text-amber-800 uppercase block">Non-Veg Total</span>
                <span className="text-2xl font-black text-amber-700">{summary.expected_non_veg_total}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              {summary.wards_unconfirmed_food} wards with unconfirmed food counts
            </p>
          </div>
        </div>
      )}

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('wards')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
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
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-amber-500 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Entry History & Voiding ({recentBatches.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'border-amber-500 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Audit Trail Logs</span>
        </button>
      </div>

      {/* TAB 1: WARD DIRECTORY TABLE */}
      {activeTab === 'wards' && (
        <div className="flex flex-col gap-4">
          {/* Search & Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search by ward number, candidate name, or party..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Party Filter */}
              <select
                value={partyFilter}
                onChange={(e) => setPartyFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
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

          {/* Ward Table */}
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
                            <button
                              onClick={() => setSelectedWardForEdit(w)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition"
                            >
                              <Edit className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span>Showing {filteredWards.length} of {wards.length} Wards</span>
              <span>Total normal capacity: 380 people (76 wards × 5 allowance)</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ENTRY HISTORY & VOIDING TABLE */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
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
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV</span>
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Ward #</th>
                  <th className="py-3 px-4">Batch Size</th>
                  <th className="py-3 px-4">Date / Time (Asia/Kolkata)</th>
                  <th className="py-3 px-4">Recorded By Staff</th>
                  <th className="py-3 px-4 text-center">Excess Warning</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Correction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {recentBatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No attendance arrivals recorded yet today.
                    </td>
                  </tr>
                ) : (
                  recentBatches.map((batch) => (
                    <tr
                      key={batch.id}
                      className={`hover:bg-slate-50/80 transition ${
                        batch.is_voided ? 'bg-slate-100/60 opacity-60' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-slate-900">
                        Ward {batch.ward_id}
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900">
                        +{batch.batch_size} {batch.batch_size === 1 ? 'person' : 'people'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {formatInKolkataTime(batch.created_at)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 block">
                          {batch.recorded_by_name || 'Staff User'}
                        </span>
                        {batch.recorded_by_email && (
                          <span className="text-[11px] text-slate-400 block">{batch.recorded_by_email}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {batch.excess_acknowledged ? (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                            Ack (+{batch.excess_count})
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {batch.is_voided ? (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                            Voided: {batch.void_reason}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!batch.is_voided ? (
                          <button
                            onClick={() => {
                              setBatchToVoid(batch);
                              setVoidReason('');
                              setVoidError(null);
                            }}
                            className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition"
                          >
                            Void Batch
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">Voided</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
