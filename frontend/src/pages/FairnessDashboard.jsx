import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  FiActivity,
  FiBarChart2,
  FiCheckCircle,
  FiAlertCircle,
  FiFilter,
  FiXCircle,
  FiMinusCircle,
  FiInfo,
  FiMoon,
  FiZap,
  FiSun,
  FiAlertTriangle,
} from 'react-icons/fi';
import api from '../api';

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'All Months', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 4 }, (_, i) => CURRENT_YEAR - i);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Fairness score (0-100):
 * 0 total violations -> 100 (algorithm never violated any constraint).
 * Penalized by the violation rate (violations / checked shifts, up to -60 pts).
 * Additionally penalized by the inequality of distribution among nurses (CV, up to -40 pts).
 */
function fairnessScore(totalViolations, totalChecked, std_dev, mean) {
  if (totalViolations === 0) return 100;
  const violationRate = totalViolations / Math.max(1, totalChecked);
  const ratePenalty = Math.min(60, Math.round(violationRate * 300));
  const cv = mean > 0 ? std_dev / mean : 0;
  const eqPenalty = Math.min(40, Math.round(cv * 80));
  return Math.max(0, 100 - ratePenalty - eqPenalty);
}

function fairnessLabel(score) {
  if (score >= 85) return { label: 'Excellent',    color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', bar: '#10b981' };
  if (score >= 65) return { label: 'Good',         color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',    bar: '#3b82f6' };
  if (score >= 40) return { label: 'Fair',         color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   bar: '#f59e0b' };
  return               { label: 'Needs Review',    color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200',     bar: '#ef4444' };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-28 rounded-2xl bg-slate-200" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-slate-100" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="h-72 rounded-2xl bg-slate-100" />
        <div className="h-72 rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

function ErrorCard({ message, onRetry }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center space-y-3">
      <FiAlertCircle className="mx-auto text-red-400" size={32} />
      <p className="text-red-600 font-medium text-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition"
        >
          Retry
        </button>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, Icon, accent = 'text-slate-800', iconBg = 'bg-slate-100', iconColor = 'text-slate-500' }) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon size={16} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">{label}</p>
        <p className={`text-xl font-extrabold leading-tight ${accent}`}>{value}</p>
        {sub && <p className="text-[11px] text-slate-400 font-medium truncate">{sub}</p>}
      </div>
    </div>
  );
}

function FairnessGauge({ label, score }) {
  const meta = fairnessLabel(score);
  const Icon = score >= 65 ? FiCheckCircle : FiAlertCircle;
  return (
    <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border text-sm font-semibold ${meta.bg} ${meta.border} ${meta.color}`}>
      <Icon size={15} />
      <span>{label}</span>
      <span className="ml-auto font-extrabold text-base">{score}/100</span>
    </div>
  );
}

function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-slate-700 mb-0.5">{label}</p>
      <p className="font-bold" style={{ color: payload[0].fill }}>
        {payload[0].value} violation{payload[0].value !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

function ViolationBarChart({ title, subtitle, data, dataKey, meanValue, barColor }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-slate-50 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-800">{title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        {meanValue !== undefined && (
          <div className="flex flex-col items-end flex-shrink-0">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Avg</span>
            <span className="text-lg font-extrabold text-slate-700">{meanValue.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="px-3 pt-4 pb-3" style={{ height: 240 }}>
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">
            No violations found for the selected filters
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={data.length > 6 ? -35 : 0}
                textAnchor={data.length > 6 ? 'end' : 'middle'}
                height={data.length > 6 ? 50 : 24}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomBarTooltip />} cursor={{ fill: '#f8fafc' }} />
              {meanValue !== undefined && meanValue > 0 && (
                <ReferenceLine
                  y={meanValue}
                  stroke="#64748b"
                  strokeDasharray="5 3"
                  strokeWidth={1.5}
                  label={{ value: `avg ${meanValue.toFixed(1)}`, position: 'right', fontSize: 9, fill: '#64748b' }}
                />
              )}
              <Bar dataKey={dataKey} radius={[5, 5, 0, 0]} maxBarSize={48}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry[dataKey] === 0 ? '#d1fae5' : barColor}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function DiffBadge({ diff }) {
  const rounded = Math.round(diff * 10) / 10;
  if (rounded === 0) return <span className="text-slate-400 text-xs">+/-0</span>;
  const pos = rounded > 0;
  return (
    <span className={`text-xs font-semibold ${pos ? 'text-red-500' : 'text-emerald-600'}`}>
      {pos ? '+' : ''}{rounded.toFixed(1)}
    </span>
  );
}

// ── Fatigue-index helpers ─────────────────────────────────────────────────────

function fatigueLevel(index) {
  if (index === 0)  return { label: 'None',     color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-200', dot: 'bg-emerald-400' };
  if (index < 5)   return { label: 'Low',      color: 'text-blue-600',    bg: 'bg-blue-50',     border: 'border-blue-200',    dot: 'bg-blue-400' };
  if (index < 10)  return { label: 'Moderate', color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-200',   dot: 'bg-amber-400' };
  return                  { label: 'High',     color: 'text-red-600',     bg: 'bg-red-50',      border: 'border-red-200',     dot: 'bg-red-500' };
}

// ── NurseStatsTable sub-component ─────────────────────────────────────────────

function NurseStatsTable({ statsData, filters, departments }) {
  const [localFilters, setLocalFilters] = useState({
    department_id: filters.department_id,
    year: filters.year,
    month: filters.month,
  });
  const [rows, setRows]       = useState(statsData);
  const [loading, setLoading] = useState(false);

  // Sync when parent filters change
  useEffect(() => {
    setLocalFilters({ department_id: filters.department_id, year: filters.year, month: filters.month });
  }, [filters]);

  // Re-fetch when localFilters change
  useEffect(() => {
    setLoading(true);
    const params = {};
    if (localFilters.department_id) params.department_id = localFilters.department_id;
    if (localFilters.year)          params.year          = localFilters.year;
    if (localFilters.month)         params.month         = localFilters.month;
    api.get('/fairness/nurse-stats', { params })
      .then((res) => setRows(res.data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [localFilters]);

  const maxFatigue = rows.length ? Math.max(...rows.map((r) => r.fatigue_index), 1) : 1;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-50 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <FiZap size={14} className="text-amber-500" />
            Nurse Fatigue &amp; Load Index
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Cumulative workload per nurse — ranked highest fatigue first.
            Fatigue = nights×2 + weekends×1.5 + forced×3
          </p>
        </div>

        {/* Mini filter for this section only */}
        <div className="flex gap-2 flex-wrap">
          <select
            value={localFilters.department_id}
            onChange={(e) => setLocalFilters((f) => ({ ...f, department_id: e.target.value }))}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-300"
          >
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select
            value={localFilters.year}
            onChange={(e) => setLocalFilters((f) => ({ ...f, year: e.target.value }))}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-300"
          >
            <option value="">All Years</option>
            {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={localFilters.month}
            onChange={(e) => setLocalFilters((f) => ({ ...f, month: e.target.value }))}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-300"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i} value={i === 0 ? '' : i}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table body */}
      {loading ? (
        <div className="p-8 text-center text-slate-400 text-sm animate-pulse">Loading fatigue data…</div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center text-slate-400 text-sm">
          No stats yet — generate a schedule first to populate the fatigue index.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                <th className="px-5 py-3 text-left">Nurse</th>
                <th className="px-5 py-3 text-right">Period</th>
                <th className="px-5 py-3 text-right">
                  <span className="flex items-center justify-end gap-1"><FiMoon size={11} /> Nights</span>
                </th>
                <th className="px-5 py-3 text-right">
                  <span className="flex items-center justify-end gap-1"><FiSun size={11} /> Weekends</span>
                </th>
                <th className="px-5 py-3 text-right">Total Shifts</th>
                <th className="px-5 py-3 text-right">
                  <span className="flex items-center justify-end gap-1"><FiAlertTriangle size={11} /> Forced</span>
                </th>
                <th className="px-5 py-3 text-right">Fatigue Index</th>
                <th className="px-5 py-3 text-left w-40">Load Bar</th>
                <th className="px-5 py-3 text-center">Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((row) => {
                const meta   = fatigueLevel(row.fatigue_index);
                const pct    = Math.round((row.fatigue_index / maxFatigue) * 100);
                const period = `${row.period_year}/${String(row.period_month).padStart(2, '0')}`;
                return (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3 font-semibold text-slate-700">{row.nurse_name ?? `#${row.nurse_id}`}</td>
                    <td className="px-5 py-3 text-right text-slate-400 font-mono text-xs">{period}</td>
                    <td className="px-5 py-3 text-right font-bold text-indigo-600">{row.night_shifts_count}</td>
                    <td className="px-5 py-3 text-right font-bold text-cyan-600">{row.weekend_shifts_count}</td>
                    <td className="px-5 py-3 text-right text-slate-500">{row.total_shifts_count}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={row.forced_assignments_count > 0 ? 'font-bold text-red-500' : 'text-slate-400'}>
                        {row.forced_assignments_count}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-extrabold text-slate-800">
                      {row.fatigue_index.toFixed(1)}
                    </td>
                    <td className="px-5 py-3 w-40">
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${meta.dot}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${meta.bg} ${meta.border} ${meta.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FairnessDashboard() {
  const [data, setData] = useState(null);
  const [nurseStats, setNurseStats] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    department_id: '',
    year: '',
    month: '',
  });

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = {};
    if (filters.department_id) params.department_id = filters.department_id;
    if (filters.year) params.year = filters.year;
    if (filters.month) params.month = filters.month;

    Promise.all([
      api.get('/fairness/shift-distribution', { params }),
      api.get('/fairness/nurse-stats', { params }),
    ])
      .then(([distRes, statsRes]) => {
        setData(distRes.data);
        setNurseStats(statsRes.data);
      })
      .catch(() => setError('Failed to load fairness data. Please try again.'))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    api.get('/departments').then((res) => setDepartments(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived chart data ────────────────────────────────────────────────────
  const hardChartData = data?.nurses.map((n) => ({
    name: n.name.split(' ')[0],
    hard_violations: n.hard_violations,
  })) ?? [];

  const softChartData = data?.nurses.map((n) => ({
    name: n.name.split(' ')[0],
    soft_violations: n.soft_violations,
  })) ?? [];

  const tStats = data?.total_stats ?? {};
  const hStats = data?.hard_stats ?? {};
  const sStats = data?.soft_stats ?? {};

  const totalViolations = data?.total_violations ?? 0;
  const totalChecked = data?.total_assignments_checked ?? 0;
  const violationRate = totalChecked > 0 ? ((totalViolations / totalChecked) * 100).toFixed(1) : '0.0';

  const overallScore = data
    ? fairnessScore(totalViolations, totalChecked, tStats.std_dev ?? 0, tStats.mean ?? 0)
    : 0;
  const hardScore = data
    ? fairnessScore(
        data.nurses.reduce((s, n) => s + n.hard_violations, 0),
        totalChecked,
        hStats.std_dev ?? 0,
        hStats.mean ?? 0,
      )
    : 0;
  const softScore = data
    ? fairnessScore(
        data.nurses.reduce((s, n) => s + n.soft_violations, 0),
        totalChecked,
        sStats.std_dev ?? 0,
        sStats.mean ?? 0,
      )
    : 0;
  const overallMeta = fairnessLabel(overallScore);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">Fairness &amp; Analytics Dashboard</h1>
        <p className="page-subtitle">
          Counts how many times each nurse was assigned a weekend or night shift they explicitly said they cannot or prefer not to work
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
        <FiInfo size={14} className="flex-shrink-0 mt-0.5" />
        <span>
          <strong>How it works:</strong> Only weekend (Fri/Sat) and night shifts are checked.
          A nurse who <em>wanted</em> those shifts is not penalized — only nurses who received a
          shift they marked as <strong>"Cannot Work"</strong> (hard) or <strong>"Prefer Not"</strong> (soft) are counted as violations.
        </span>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-end bg-white border border-slate-100 rounded-2xl shadow-sm px-5 py-4">
        <div className="flex items-center gap-1.5 text-slate-500 text-sm font-medium mr-1">
          <FiFilter size={14} />
          Filters
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Department</label>
          <select
            value={filters.department_id}
            onChange={(e) => setFilters((f) => ({ ...f, department_id: e.target.value }))}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[150px]"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Year</label>
          <select
            value={filters.year}
            onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">All Years</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Month</label>
          <select
            value={filters.month}
            onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value }))}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i} value={i === 0 ? '' : i}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <Skeleton />
      ) : error ? (
        <ErrorCard message={error} onRetry={fetchData} />
      ) : (
        <>
          {/* Hero banner */}
          <div
            className="relative rounded-2xl overflow-hidden px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 60%, #0e7490 100%)' }}
          >
            <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-cyan-400 opacity-10 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 w-28 h-28 rounded-full bg-blue-400 opacity-10 blur-2xl pointer-events-none" />

            <div className="relative z-10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
                <FiActivity size={22} className="text-sky-300" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg leading-tight">Overall Fairness Score</h2>
                <p className="text-sky-300 text-xs mt-0.5">
                  {totalViolations === 0
                    ? `Zero constraint violations across ${totalChecked} weekend/night shifts checked`
                    : `${totalViolations} violation${totalViolations !== 1 ? 's' : ''} out of ${totalChecked} weekend/night shifts checked (${violationRate}%)`
                  }
                </p>
              </div>
            </div>

            <div className={`relative z-10 flex items-center gap-3 px-5 py-3 rounded-xl border ${overallMeta.bg} ${overallMeta.border} flex-shrink-0`}>
              <div>
                <p className="text-[11px] uppercase tracking-widest font-semibold text-slate-500">Fairness</p>
                <p className={`text-4xl font-black leading-none ${overallMeta.color}`}>{overallScore}</p>
                <p className={`text-xs font-bold ${overallMeta.color}`}>{overallMeta.label}</p>
              </div>
              <div className="w-16 h-16">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke={overallMeta.bar}
                    strokeWidth="3"
                    strokeDasharray={`${overallScore} ${100 - overallScore}`}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Total Violations"
              value={totalViolations}
              sub="cannot work + prefer not"
              Icon={FiAlertCircle}
              accent={totalViolations === 0 ? 'text-emerald-600' : 'text-red-600'}
              iconBg={totalViolations === 0 ? 'bg-emerald-50' : 'bg-red-50'}
              iconColor={totalViolations === 0 ? 'text-emerald-500' : 'text-red-500'}
            />
            <StatCard
              label="Violation Rate"
              value={`${violationRate}%`}
              sub={`of ${totalChecked} weekend/night shifts`}
              Icon={FiBarChart2}
              accent={parseFloat(violationRate) === 0 ? 'text-emerald-600' : 'text-slate-800'}
              iconBg="bg-slate-100"
              iconColor="text-slate-500"
            />
            <StatCard
              label="Cannot Work"
              value={data.nurses.reduce((s, n) => s + n.hard_violations, 0)}
              sub={`avg ${hStats.mean?.toFixed(2) ?? '0'} per nurse`}
              Icon={FiXCircle}
              accent="text-red-600"
              iconBg="bg-red-50"
              iconColor="text-red-500"
            />
            <StatCard
              label="Prefer Not"
              value={data.nurses.reduce((s, n) => s + n.soft_violations, 0)}
              sub={`avg ${sStats.mean?.toFixed(2) ?? '0'} per nurse`}
              Icon={FiMinusCircle}
              accent="text-amber-600"
              iconBg="bg-amber-50"
              iconColor="text-amber-500"
            />
          </div>

          {/* Fairness gauges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FairnessGauge label="Cannot Work Distribution" score={hardScore} />
            <FairnessGauge label="Prefer Not Distribution" score={softScore} />
          </div>

          {/* Bar charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ViolationBarChart
              title='"Cannot Work" Violations per Nurse'
              subtitle="Assigned to a weekend/night shift despite marking Cannot Work — green bar = zero"
              data={hardChartData}
              dataKey="hard_violations"
              meanValue={hStats.mean}
              barColor="#ef4444"
            />
            <ViolationBarChart
              title='"Prefer Not" Violations per Nurse'
              subtitle="Assigned to a weekend/night shift despite marking Prefer Not — green bar = zero"
              data={softChartData}
              dataKey="soft_violations"
              meanValue={sStats.mean}
              barColor="#f59e0b"
            />
          </div>

          {/* Per-nurse table */}
          {data.nurses.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50">
                <p className="text-sm font-bold text-slate-800">Per-Nurse Violation Breakdown</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Only nurses who had at least one weekend or night shift assignment appear in this table
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                      <th className="px-5 py-3 text-left">Nurse</th>
                      <th className="px-5 py-3 text-right">Wknd/Night Shifts</th>
                      <th className="px-5 py-3 text-right">Cannot Work</th>
                      <th className="px-5 py-3 text-right">Prefer Not</th>
                      <th className="px-5 py-3 text-right">Total Violations</th>
                      <th className="px-5 py-3 text-right">vs Average</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.nurses.map((nurse) => {
                      const diff = tStats.mean != null ? nurse.total_violations - tStats.mean : 0;
                      const isOutlier = tStats.std_dev != null && Math.abs(diff) > tStats.std_dev && nurse.total_violations > 0;
                      return (
                        <tr key={nurse.nurse_id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3 font-semibold text-slate-700">{nurse.name}</td>
                          <td className="px-5 py-3 text-right text-slate-500">{nurse.weekend_night_shifts}</td>
                          <td className="px-5 py-3 text-right">
                            <span className={`font-bold ${nurse.hard_violations > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              {nurse.hard_violations}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className={`font-bold ${nurse.soft_violations > 0 ? 'text-amber-500' : 'text-emerald-600'}`}>
                              {nurse.soft_violations}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className={`font-bold ${isOutlier ? 'text-red-600' : nurse.total_violations > 0 ? 'text-slate-700' : 'text-emerald-600'}`}>
                              {nurse.total_violations}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <DiffBadge diff={diff} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 text-[11px] text-slate-500 font-semibold border-t border-slate-100">
                    <tr>
                      <td className="px-5 py-3">Mean</td>
                      <td />
                      <td className="px-5 py-3 text-right text-red-500">{hStats.mean?.toFixed(2)}</td>
                      <td className="px-5 py-3 text-right text-amber-500">{sStats.mean?.toFixed(2)}</td>
                      <td className="px-5 py-3 text-right text-slate-600">{tStats.mean?.toFixed(2)}</td>
                      <td />
                    </tr>
                    <tr>
                      <td className="px-5 py-3">Std Dev</td>
                      <td />
                      <td className="px-5 py-3 text-right text-red-500">{hStats.std_dev?.toFixed(2)}</td>
                      <td className="px-5 py-3 text-right text-amber-500">{sStats.std_dev?.toFixed(2)}</td>
                      <td className="px-5 py-3 text-right text-slate-600">{tStats.std_dev?.toFixed(2)}</td>
                      <td />
                    </tr>
                    <tr>
                      <td className="px-5 py-3">Variance</td>
                      <td />
                      <td className="px-5 py-3 text-right text-red-500">{hStats.variance?.toFixed(2)}</td>
                      <td className="px-5 py-3 text-right text-amber-500">{sStats.variance?.toFixed(2)}</td>
                      <td className="px-5 py-3 text-right text-slate-600">{tStats.variance?.toFixed(2)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {data.nurses.length === 0 && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-10 text-center text-slate-400 text-sm">
              No weekend or night shift assignments found for the selected filters.
            </div>
          )}

          {/* Nurse Fatigue & Load Index table */}
          <NurseStatsTable
            statsData={nurseStats}
            filters={filters}
            departments={departments}
          />
        </>
      )}
    </div>
  );
}
