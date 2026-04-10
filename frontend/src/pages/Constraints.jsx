import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../api';
import {
  FiTrash2, FiSliders, FiAlertCircle,
  FiChevronLeft, FiChevronRight, FiSave, FiCheckCircle,
} from 'react-icons/fi';

const SHIFTS = [
  { value: 'morning',   label: 'Morning',   time: '07:00–15:00' },
  { value: 'afternoon', label: 'Afternoon', time: '15:00–23:00' },
  { value: 'night',     label: 'Night',     time: '23:00–07:00' },
];

const CONSTRAINT_TYPES = [
  { value: 'cannot_work', label: 'Cannot Work' },
  { value: 'prefer_not',  label: 'Prefer Not'  },
  { value: 'prefer',      label: 'Prefer'      },
];

const BADGE_MAP = {
  cannot_work: 'badge-cannot',
  prefer_not:  'badge-prefer-not',
  prefer:      'badge-prefer',
};
const SHIFT_BADGE = {
  morning:   'badge-morning',
  afternoon: 'badge-afternoon',
  night:     'badge-night',
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateStr(date) {
  return date.toISOString().split('T')[0];
}

function displayDate(date) {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// cell color styles for each constraint type
const CELL_STYLES = {
  cannot_work: {
    active:   'bg-red-500 text-white border-red-500 shadow',
    inactive: 'text-red-500 border-red-200 hover:bg-red-50',
  },
  prefer_not: {
    active:   'bg-amber-400 text-white border-amber-400 shadow',
    inactive: 'text-amber-600 border-amber-200 hover:bg-amber-50',
  },
  prefer: {
    active:   'bg-emerald-500 text-white border-emerald-500 shadow',
    inactive: 'text-emerald-600 border-emerald-200 hover:bg-emerald-50',
  },
};

export default function Constraints() {
  const [constraints, setConstraints]   = useState([]);
  const [weekStart, setWeekStart]       = useState(() => getWeekStart(new Date()));
  // selections: { 'YYYY-MM-DD|shift': 'cannot_work'|'prefer_not'|'prefer' }
  const [selections, setSelections]     = useState({});
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');
  const [loading, setLoading]           = useState(false);

  const weekDates = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
  [weekStart]);

  const fetchConstraints = useCallback(() => {
    api.get('/constraints/').then((res) =>
      setConstraints([...res.data].sort((a, b) => a.date.localeCompare(b.date)))
    );
  }, []);

  useEffect(fetchConstraints, [fetchConstraints]);

  // Pre-fill table from existing saved constraints when week changes
  useEffect(() => {
    const sel = {};
    weekDates.forEach((d) => {
      const ds = toDateStr(d);
      SHIFTS.forEach((s) => {
        const existing = constraints.find((c) => c.date === ds && c.shift_type === s.value);
        if (existing) sel[`${ds}|${s.value}`] = existing.constraint_type;
      });
    });
    setSelections(sel);
  }, [weekStart, constraints, weekDates]);

  const toggleCell = (dateStr, shift, ctValue) => {
    const key = `${dateStr}|${shift}`;
    setSelections((prev) => ({
      ...prev,
      [key]: prev[key] === ctValue ? undefined : ctValue,
    }));
  };

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    const weekDateStrs = weekDates.map(toDateStr);
    try {
      // Delete all existing constraints for this week first
      const toDelete = constraints.filter((c) => weekDateStrs.includes(c.date));
      await Promise.all(toDelete.map((c) => api.delete(`/constraints/${c.id}`)));

      // Post new selections
      const entries = Object.entries(selections).filter(([, v]) => v);
      await Promise.all(
        entries.map(([key, ctValue]) => {
          const [date, shift] = key.split('|');
          return api.post('/constraints/', { date, shift_type: shift, constraint_type: ctValue, note: '' });
        })
      );

      setSuccess('Constraints saved successfully!');
      fetchConstraints();
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save constraints');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    await api.delete(`/constraints/${id}`);
    fetchConstraints();
  };

  const todayStr = toDateStr(new Date());

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <FiSliders className="text-amber-500" /> My Shift Constraints
        </h1>
        <p className="page-subtitle">Choose your preference for each shift then save the whole week at once.</p>
      </div>

      {/* ── Weekly grid ─────────────────────────── */}
      <div className="section-card">

        {/* Week navigator */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={prevWeek} className="btn-ghost px-3 py-2">
            <FiChevronLeft size={18} />
          </button>
          <div className="text-center">
            <div className="text-base font-bold text-slate-800">
              {displayDate(weekDates[0])} – {displayDate(weekDates[6])}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {weekDates[0].toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </div>
          </div>
          <button onClick={nextWeek} className="btn-ghost px-3 py-2">
            <FiChevronRight size={18} />
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-5 text-xs">
          {CONSTRAINT_TYPES.map((ct) => (
            <span
              key={ct.value}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border font-medium ${CELL_STYLES[ct.value].active}`}
            >
              {ct.label}
            </span>
          ))}
          <span className="text-slate-400 self-center ml-1">Click a button to toggle it on/off</span>
        </div>

        {error && (
          <div className="alert-error mb-4">
            <FiAlertCircle size={15} className="flex-shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="alert-success mb-4">
            <FiCheckCircle size={15} className="flex-shrink-0" /> {success}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">
                  Day
                </th>
                {SHIFTS.map((s) => (
                  <th key={s.value} className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <div>{s.label}</div>
                    <div className="text-slate-400 font-normal normal-case mt-0.5">{s.time}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weekDates.map((d) => {
                const dateStr = toDateStr(d);
                const isToday = dateStr === todayStr;
                return (
                  <tr
                    key={dateStr}
                    className={`border-b border-slate-50 last:border-0 ${isToday ? 'bg-blue-50/50' : 'hover:bg-slate-50/60'}`}
                  >
                    {/* Day label */}
                    <td className="px-4 py-4">
                      <div className={`font-semibold text-sm ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>
                        {DAYS[d.getDay()]}
                      </div>
                      <div className={`text-xs mt-0.5 ${isToday ? 'text-blue-400 font-medium' : 'text-slate-400'}`}>
                        {displayDate(d)}
                        {isToday && <span className="ml-1.5 px-1.5 py-0.5 bg-blue-500 text-white rounded-full text-[10px]">Today</span>}
                      </div>
                    </td>

                    {/* Shift cells */}
                    {SHIFTS.map((s) => {
                      const key = `${dateStr}|${s.value}`;
                      const selected = selections[key];
                      return (
                        <td key={s.value} className="px-3 py-4">
                          <div className="flex flex-col gap-1.5 items-center">
                            {CONSTRAINT_TYPES.map((ct) => {
                              const isActive = selected === ct.value;
                              const styles = CELL_STYLES[ct.value];
                              return (
                                <button
                                  key={ct.value}
                                  onClick={() => toggleCell(dateStr, s.value, ct.value)}
                                  className={`w-full text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all duration-150 ${
                                    isActive ? styles.active : styles.inactive
                                  }`}
                                >
                                  {ct.label}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-5">
          <button onClick={handleSave} disabled={loading} className="btn-primary">
            <FiSave size={15} />
            {loading ? 'Saving…' : 'Save Week Constraints'}
          </button>
        </div>
      </div>

      {/* ── All constraints list ─────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <span className="font-semibold text-slate-800 text-sm">
            All My Constraints
            {constraints.length > 0 && (
              <span className="ml-2 badge bg-slate-100 text-slate-600">{constraints.length}</span>
            )}
          </span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Shift</th>
              <th>Type</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {constraints.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-5 py-12 text-center text-slate-400">
                  No constraints yet — select preferences above and save.
                </td>
              </tr>
            ) : (
              constraints.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.date}</td>
                  <td><span className={SHIFT_BADGE[c.shift_type]}>{c.shift_type}</span></td>
                  <td>
                    <span className={BADGE_MAP[c.constraint_type]}>
                      {c.constraint_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="text-slate-500">{c.note || <span className="text-slate-300">—</span>}</td>
                  <td>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="btn-danger-ghost"
                      title="Delete constraint"
                    >
                      <FiTrash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
