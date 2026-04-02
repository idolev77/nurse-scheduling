import { useState, useEffect, useCallback } from 'react';
import {
  FiRepeat,
  FiCalendar,
  FiSun,
  FiCloud,
  FiMoon,
  FiUser,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiRefreshCw,
  FiAlertCircle,
} from 'react-icons/fi';
import api from '../api';

// ── Constants ──────────────────────────────────────────────────────────────────

const SHIFT_META = {
  morning: {
    label: 'Morning',
    hours: '07:00 – 15:00',
    Icon: FiSun,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-700',
  },
  afternoon: {
    label: 'Afternoon',
    hours: '15:00 – 23:00',
    Icon: FiCloud,
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-600',
    badge: 'bg-indigo-100 text-indigo-700',
  },
  night: {
    label: 'Night',
    hours: '23:00 – 07:00',
    Icon: FiMoon,
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-600',
    badge: 'bg-sky-100 text-sky-700',
  },
};

const POLL_INTERVAL_MS = 30_000; // notify of new offers every 30 s

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SwapCard({ swap, onClaim, claiming }) {
  const meta = SHIFT_META[swap.shift_type] || SHIFT_META.morning;
  const { Icon } = meta;

  return (
    <div
      className={`rounded-2xl border ${meta.border} ${meta.bg} p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.badge}`}>
          <Icon size={13} />
          {meta.label} · {meta.hours}
        </span>
        <span className="text-xs text-slate-400">{formatDate(swap.shift_date)}</span>
      </div>

      {/* Department */}
      {swap.department_name && (
        <p className="text-sm font-medium text-slate-700">
          Dept: <span className="text-slate-900">{swap.department_name}</span>
        </p>
      )}

      {/* Offered by */}
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <FiUser size={14} className="shrink-0" />
        <span>
          Offered by <span className="font-medium text-slate-800">{swap.requester_name}</span>
        </span>
      </div>

      {/* Note */}
      {swap.note && (
        <p className="text-xs italic text-slate-500 bg-white/70 rounded-lg px-3 py-2 border border-slate-100">
          "{swap.note}"
        </p>
      )}

      {/* Posted ago */}
      <p className="text-xs text-slate-400 flex items-center gap-1">
        <FiClock size={12} />
        Posted {new Date(swap.created_at).toLocaleString('en-GB')}
      </p>

      {/* CTA */}
      <button
        onClick={() => onClaim(swap.id)}
        disabled={claiming === swap.id}
        className="mt-1 w-full py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
      >
        {claiming === swap.id ? 'Claiming…' : 'Claim This Shift'}
      </button>
    </div>
  );
}

function MyOfferRow({ offer, onCancel, cancelling }) {
  const meta = SHIFT_META[offer.shift_type] || SHIFT_META.morning;
  const statusStyles = {
    open: 'bg-emerald-100 text-emerald-700',
    claimed: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-slate-100 text-slate-500',
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${meta.badge}`}>
          {meta.label}
        </span>
        <span className="text-sm text-slate-700 truncate">{formatDate(offer.shift_date)}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${statusStyles[offer.status] || ''}`}
        >
          {offer.status === 'open' && <FiClock size={11} />}
          {offer.status === 'claimed' && <FiCheckCircle size={11} />}
          {offer.status === 'cancelled' && <FiXCircle size={11} />}
          {offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
          {offer.status === 'claimed' && offer.claimant_name && ` by ${offer.claimant_name}`}
        </span>
        {offer.status === 'open' && (
          <button
            onClick={() => onCancel(offer.id)}
            disabled={cancelling === offer.id}
            className="text-xs text-rose-500 hover:text-rose-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelling === offer.id ? 'Cancelling…' : 'Cancel'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function SwapMarketplace() {
  const [openSwaps, setOpenSwaps] = useState([]);
  const [myOffers, setMyOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [claiming, setClaiming] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [prevCount, setPrevCount] = useState(null);
  const [newBadge, setNewBadge] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [boardRes, mineRes] = await Promise.all([
        api.get('/swap-requests'),
        api.get('/swap-requests/mine'),
      ]);

      const incoming = boardRes.data;
      // Detect new arrivals for the polling notification
      if (prevCount !== null && incoming.length > prevCount) {
        setNewBadge(true);
        showToast(`${incoming.length - prevCount} new swap offer(s) available!`);
      }
      setPrevCount(incoming.length);
      setOpenSwaps(incoming);
      setMyOffers(mineRes.data);
      setError('');
    } catch {
      setError('Failed to load swap data. Please refresh.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [prevCount]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling for new offers (SSE-lite via polling)
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const handleClaim = async (swapId) => {
    setClaiming(swapId);
    try {
      await api.post(`/swap-requests/${swapId}/claim`);
      showToast('Shift claimed successfully!');
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not claim shift.');
    } finally {
      setClaiming(null);
    }
  };

  const handleCancel = async (swapId) => {
    setCancelling(swapId);
    try {
      await api.delete(`/swap-requests/${swapId}`);
      showToast('Swap offer cancelled.');
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not cancel offer.');
    } finally {
      setCancelling(null);
    }
  };

  const handleRefresh = () => {
    setNewBadge(false);
    fetchData();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-slate-800 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in-up">
          <FiAlertCircle size={16} />
          {toast}
        </div>
      )}

      {/* Page header */}
      <div className="page-header">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <FiRepeat className="text-emerald-500" />
              Shift Swap Marketplace
            </h1>
            <p className="page-subtitle">
              Offer your shift to colleagues or pick up an available one
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="relative inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <FiRefreshCw size={15} />
            Refresh
            {newBadge && (
              <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-white" />
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <FiXCircle size={16} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Left: Open swap board ── */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800">
              Available Shifts
              {openSwaps.length > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                  {openSwaps.length}
                </span>
              )}
            </h2>
            <span className="text-xs text-slate-400">Auto-refreshes every 30 s</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="rounded-2xl border border-slate-100 bg-slate-50 h-44 animate-pulse" />
              ))}
            </div>
          ) : openSwaps.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center">
              <FiRepeat size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No shifts offered for swap right now</p>
              <p className="text-slate-400 text-sm mt-1">Check back later or offer your own shift below</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {openSwaps.map((swap) => (
                <SwapCard key={swap.id} swap={swap} onClaim={handleClaim} claiming={claiming} />
              ))}
            </div>
          )}
        </div>

        {/* ── Right: My offers ── */}
        <div>
          <h2 className="text-base font-semibold text-slate-800 mb-4">My Swap Offers</h2>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((n) => (
                  <div key={n} className="h-8 bg-slate-100 rounded animate-pulse" />
                ))}
              </div>
            ) : myOffers.length === 0 ? (
              <div className="text-center py-8">
                <FiCalendar size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-slate-400 text-sm">You haven't offered any shifts yet</p>
                <p className="text-slate-400 text-xs mt-1">
                  Go to <span className="font-medium">View Schedule</span> and click "Offer for Swap" on a shift
                </p>
              </div>
            ) : (
              <div>
                {myOffers.map((offer) => (
                  <MyOfferRow
                    key={offer.id}
                    offer={offer}
                    onCancel={handleCancel}
                    cancelling={cancelling}
                  />
                ))}
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="mt-6 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">How It Works</h3>
            <ol className="space-y-2.5 text-xs text-slate-600">
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0">1</span>
                Go to <span className="font-medium mx-0.5">View Schedule</span> and click "Offer for Swap" on any future shift you hold.
              </li>
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0">2</span>
                The shift appears on this board for all nurses in the system.
              </li>
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0">3</span>
                Any nurse without a conflicting shift can click <span className="font-medium mx-0.5">Claim This Shift</span>.
              </li>
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0">4</span>
                The assignment is instantly transferred — no manager action needed.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
