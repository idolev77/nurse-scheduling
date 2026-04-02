import { useState, useEffect } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  FiSun,
  FiMoon,
  FiCloud,
  FiClock,
  FiTrendingUp,
  FiTrendingDown,
  FiMinus,
  FiActivity,
  FiAward,
  FiZap,
} from 'react-icons/fi';
import api from '../api';

// ── Constants ────────────────────────────────────────────────────────────────

const SHIFT_META = {
  morning: {
    label: 'Morning',
    subLabel: '07:00 – 15:00',
    Icon: FiSun,
    color: '#f59e0b',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-600',
    bar: '#f59e0b',
  },
  afternoon: {
    label: 'Afternoon',
    subLabel: '15:00 – 23:00',
    Icon: FiCloud,
    color: '#6366f1',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-600',
    bar: '#6366f1',
  },
  night: {
    label: 'Night',
    subLabel: '23:00 – 07:00',
    Icon: FiMoon,
    color: '#0ea5e9',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-600',
    bar: '#0ea5e9',
  },
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ── Custom Tooltip for Bar Chart ─────────────────────────────────────────────

function BarTooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-slate-700 mb-0.5">{label}</p>
      <p className="text-blue-600 font-bold">{payload[0].value}h worked</p>
    </div>
  );
}

// ── Donut center label ────────────────────────────────────────────────────────

function DonutLabel({ viewBox, pct }) {
  if (!viewBox) return null;
  const { cx, cy } = viewBox;
  return (
    <g>
      <text
        x={cx}
        y={cy - 7}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: 22, fontWeight: 800, fill: '#0f172a' }}
      >
        {pct}%
      </text>
      <text
        x={cx}
        y={cy + 15}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }}
      >
        complete
      </text>
    </g>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-pulse">
      <div className="h-16 bg-gradient-to-r from-slate-200 to-slate-300" />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-52 bg-slate-100 rounded-xl" />
          <div className="h-52 bg-slate-100 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ── Error card ────────────────────────────────────────────────────────────────

function ErrorCard({ message }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center text-red-500 text-sm font-medium">
      {message}
    </div>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="flex flex-col gap-0.5 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`text-xl font-extrabold ${accent || 'text-slate-800'}`}>{value}</span>
      {sub && <span className="text-[11px] text-slate-400 font-medium">{sub}</span>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ShiftHoursSummary() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/shift-summary/me')
      .then((res) => setData(res.data))
      .catch(() => setError('Unable to load shift summary. Please try again later.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton />;
  if (error) return <ErrorCard message={error} />;

  const {
    total_hours,
    monthly_quota,
    effective_quota,
    leave_days,
    leave_hours,
    hours_remaining,
    completion_pct,
    shifts_count,
    avg_hours_per_shift,
    most_frequent_shift,
    shift_breakdown,
    weekly_distribution,
    prev_month_comparison,
    month,
    year,
  } = data;

  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;
  const workedVal = total_hours > 0 ? total_hours : 0;
  const quotaForDonut = effective_quota ?? monthly_quota;
  const remainVal = hours_remaining > 0 ? hours_remaining : (workedVal === 0 ? quotaForDonut : 0);
  const donutData = [
    { name: 'Completed', value: workedVal },
    { name: 'Remaining', value: remainVal },
  ];

  // Comparison badge
  const { change_hours, change_pct } = prev_month_comparison;
  const changeSign = change_hours > 0 ? '+' : '';
  const TrendIcon = change_hours > 0 ? FiTrendingUp : change_hours < 0 ? FiTrendingDown : FiMinus;
  const trendColor =
    change_hours > 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : change_hours < 0 ? 'text-red-500 bg-red-50 border-red-200'
    : 'text-slate-500 bg-slate-50 border-slate-200';

  const mostFreqMeta = most_frequent_shift ? SHIFT_META[most_frequent_shift] : null;

  return (
    <div className="card-hover overflow-hidden">
      {/* ── Header ── */}
      <div
        className="relative px-6 py-4 flex items-center justify-between overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 60%, #0e7490 100%)' }}
      >
        {/* Decorative blobs */}
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-cyan-400 opacity-10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-24 h-24 rounded-full bg-blue-400 opacity-10 blur-xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
            <FiActivity size={18} className="text-sky-300" />
          </div>
          <div>
            <h2 className="text-white font-bold text-base leading-tight">Smart Shift Hours Summary</h2>
            <p className="text-sky-300 text-xs font-medium mt-0.5">{monthLabel}</p>
          </div>
        </div>

        {/* Trend badge */}
        {change_pct !== null && (
          <div
            className={`relative z-10 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${trendColor}`}
          >
            <TrendIcon size={12} />
            {changeSign}{change_hours}h vs last month
          </div>
        )}
      </div>

      <div className="p-6 space-y-5">
        {/* Leave notice banner */}
        {leave_days > 0 && (
          <div className="flex items-center gap-2 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-xl px-4 py-2">
            <FiClock size={13} className="flex-shrink-0" />
            {leave_days} approved leave day{leave_days !== 1 ? 's' : ''} ({leave_hours}h) deducted — effective quota this month: <strong>{effective_quota}h</strong>
          </div>
        )}

        {/* ── Key Metrics Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Hours Worked"
            value={`${total_hours}h`}
            sub={`of ${effective_quota ?? monthly_quota}h effective quota`}
            accent="text-blue-600"
          />
          <StatCard
            label="Hours Remaining"
            value={`${hours_remaining}h`}
            sub="to meet quota"
            accent={hours_remaining === 0 ? 'text-emerald-600' : 'text-slate-800'}
          />
          <StatCard
            label="Shifts This Month"
            value={shifts_count}
            sub="completed shifts"
          />
          <StatCard
            label="Avg per Shift"
            value={`${avg_hours_per_shift}h`}
            sub="hours / shift"
          />
        </div>

        {/* ── Charts Row ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Donut Chart */}
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 flex flex-col items-center">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 self-start">
              Monthly Quota Progress
            </p>
            <div className="w-full" style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={80}
                    startAngle={90}
                    endAngle={-270}
                    strokeWidth={0}
                    dataKey="value"
                    labelLine={false}
                    label={(props) => <DonutLabel {...props} pct={completion_pct} />}
                  >
                    <Cell fill="#3b82f6" />
                    <Cell fill="#e2e8f0" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mt-1">
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                Worked ({total_hours}h)
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-200 inline-block" />
                Remaining ({hours_remaining}h of {effective_quota ?? monthly_quota}h)
              </span>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Weekly Distribution
            </p>
            <div className="w-full" style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weekly_distribution}
                  margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    unit="h"
                  />
                  <Tooltip content={<BarTooltipContent />} cursor={{ fill: '#f1f5f9', radius: 6 }} />
                  <Bar dataKey="hours" fill="#3b82f6" radius={[5, 5, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Shift Type Breakdown ── */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Shift Breakdown
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.entries(SHIFT_META).map(([type, meta]) => {
              const stats = shift_breakdown[type];
              const pct =
                shifts_count > 0
                  ? Math.round((stats.count / shifts_count) * 100)
                  : 0;
              const { Icon } = meta;
              const isMostFrequent = most_frequent_shift === type;
              return (
                <div
                  key={type}
                  className={`relative rounded-xl border ${meta.border} ${meta.bg} px-4 py-3 flex items-center gap-3 overflow-hidden`}
                >
                  {isMostFrequent && (
                    <span
                      className="absolute top-1.5 right-2 flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: meta.color + '22', color: meta.color }}
                    >
                      <FiAward size={9} />
                      Top
                    </span>
                  )}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: meta.color + '1a' }}
                  >
                    <Icon size={17} style={{ color: meta.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold ${meta.text}`}>{meta.label}</p>
                    <p className="text-[11px] text-slate-400 mb-1">{meta.subLabel}</p>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 font-semibold">
                        {stats.count} shift{stats.count !== 1 ? 's' : ''}
                      </span>
                      <span className="text-slate-500">{stats.hours}h · {pct}%</span>
                    </div>
                    {/* Mini progress bar */}
                    <div className="mt-1.5 h-1 bg-white/60 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: meta.color }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Smart Insight Footer ── */}
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-100">
          {/* Avg hours */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <FiClock size={13} className="text-slate-400" />
            Avg shift:
            <span className="text-slate-700 font-bold">{avg_hours_per_shift}h</span>
          </div>

          {/* Most frequent */}
          {mostFreqMeta && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <FiZap size={13} className="text-slate-400" />
              Most frequent:
              <span className={`font-bold ${mostFreqMeta.text}`}>{mostFreqMeta.label}</span>
            </div>
          )}

          {/* vs Last month */}
          {change_pct !== null && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium ml-auto">
              <TrendIcon size={13} className={change_hours >= 0 ? 'text-emerald-500' : 'text-red-400'} />
              vs last month:
              <span className={`font-bold ${change_hours >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {changeSign}{change_hours}h ({changeSign}{change_pct}%)
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
