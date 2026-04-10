import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../api';
import {
  FiSliders, FiChevronLeft, FiChevronRight,
  FiUser, FiSearch,
} from 'react-icons/fi';

const SHIFTS = [
  { value: 'morning',   label: 'Morning',   time: '07:00–15:00' },
  { value: 'afternoon', label: 'Afternoon', time: '15:00–23:00' },
  { value: 'night',     label: 'Night',     time: '23:00–07:00' },
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CONSTRAINT_COLOR = {
  cannot_work: { bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500',     label: 'Cannot Work' },
  prefer_not:  { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-400',   label: 'Prefer Not'  },
  prefer:      { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Prefer'      },
};

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}
function toDateStr(date) { return date.toISOString().split('T')[0]; }
function displayDate(date) {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function AllConstraints() {
  const [users, setUsers]               = useState([]);
  const [selectedId, setSelectedId]     = useState(null);
  const [constraints, setConstraints]   = useState([]);
  const [weekStart, setWeekStart]       = useState(() => getWeekStart(new Date()));
  const [search, setSearch]             = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingCons, setLoadingCons]   = useState(false);

  // Load nurses list
  useEffect(() => {
    api.get('/users/')
      .then((res) => {
        const nurses = res.data.filter((u) => u.role === 'nurse');
        setUsers(nurses);
        if (nurses.length > 0) setSelectedId(nurses[0].id);
      })
      .finally(() => setLoadingUsers(false));
  }, []);

  // Load constraints for selected nurse
  const fetchConstraints = useCallback(() => {
    if (!selectedId) return;
    setLoadingCons(true);
    api.get(`/constraints/?nurse_id=${selectedId}`)
      .then((res) => setConstraints([...res.data].sort((a, b) => a.date.localeCompare(b.date))))
      .finally(() => setLoadingCons(false));
  }, [selectedId]);

  useEffect(fetchConstraints, [fetchConstraints]);

  const weekDates = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
  [weekStart]);

  // Map constraints into lookup: { 'YYYY-MM-DD|shift': constraint_type }
  const cellMap = useMemo(() => {
    const map = {};
    weekDates.forEach((d) => {
      const ds = toDateStr(d);
      SHIFTS.forEach((s) => {
        const c = constraints.find((x) => x.date === ds && x.shift_type === s.value);
        if (c) map[`${ds}|${s.value}`] = c.constraint_type;
      });
    });
    return map;
  }, [constraints, weekDates]);

  const filteredUsers = useMemo(() =>
    users.filter((u) =>
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase())
    ),
  [users, search]);

  const selectedUser = users.find((u) => u.id === selectedId);
  const todayStr = toDateStr(new Date());

  const prevWeek = () => {
    const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d);
  };
  const nextWeek = () => {
    const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <FiSliders className="text-violet-500" /> Staff Constraints Overview
        </h1>
        <p className="page-subtitle">View each nurse's weekly shift preferences and unavailability.</p>
      </div>

      <div className="flex gap-6 items-start">

        {/* ── Nurse sidebar ─────────────────────── */}
        <div className="card w-64 flex-shrink-0">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="relative">
              <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="field pl-8 text-xs py-2"
                placeholder="Search nurse…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-[60vh] divide-y divide-slate-50">
            {loadingUsers ? (
              <div className="px-4 py-6 text-center text-slate-400 text-sm">Loading…</div>
            ) : filteredUsers.length === 0 ? (
              <div className="px-4 py-6 text-center text-slate-400 text-sm">No nurses found</div>
            ) : (
              filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedId(u.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ${
                    selectedId === u.id
                      ? 'bg-violet-50 border-l-[3px] border-violet-500'
                      : 'hover:bg-slate-50 border-l-[3px] border-transparent'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    selectedId === u.id ? 'bg-violet-500 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {u.first_name[0]}{u.last_name[0]}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-sm font-medium truncate ${selectedId === u.id ? 'text-violet-700' : 'text-slate-700'}`}>
                      {u.first_name} {u.last_name}
                    </div>
                    <div className="text-xs text-slate-400 truncate">{u.email}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Weekly view ───────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="section-card">

            {/* Header: selected nurse + week navigator */}
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                {selectedUser ? (
                  <>
                    <div className="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center text-white text-sm font-bold">
                      {selectedUser.first_name[0]}{selectedUser.last_name[0]}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">
                        {selectedUser.first_name} {selectedUser.last_name}
                      </div>
                      <div className="text-xs text-slate-400">{selectedUser.email}</div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <FiUser size={16} /> Select a nurse
                  </div>
                )}
              </div>

              {/* Week navigator */}
              <div className="flex items-center gap-2">
                <button onClick={prevWeek} className="btn-ghost px-2.5 py-2 text-xs">
                  <FiChevronLeft size={16} />
                </button>
                <div className="text-center min-w-[140px]">
                  <div className="text-sm font-semibold text-slate-800">
                    {displayDate(weekDates[0])} – {displayDate(weekDates[6])}
                  </div>
                  <div className="text-xs text-slate-400">
                    {weekDates[0].toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </div>
                </div>
                <button onClick={nextWeek} className="btn-ghost px-2.5 py-2 text-xs">
                  <FiChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-2 mb-5">
              {Object.entries(CONSTRAINT_COLOR).map(([k, v]) => (
                <span key={k} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${v.bg} ${v.text}`}>
                  <span className={`w-2 h-2 rounded-full ${v.dot}`} />
                  {v.label}
                </span>
              ))}
              <span className="text-slate-400 text-xs self-center ml-1">— No preference</span>
            </div>

            {/* Table */}
            {!selectedId ? (
              <div className="text-center py-16 text-slate-400">
                <FiUser size={32} className="mx-auto mb-3 opacity-30" />
                Select a nurse from the list to view their constraints.
              </div>
            ) : loadingCons ? (
              <div className="text-center py-16 text-slate-400 text-sm">Loading…</div>
            ) : (
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
                          className={`border-b border-slate-50 last:border-0 ${isToday ? 'bg-blue-50/40' : ''}`}
                        >
                          <td className="px-4 py-4">
                            <div className={`font-semibold text-sm ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>
                              {DAYS[d.getDay()]}
                            </div>
                            <div className={`text-xs mt-0.5 ${isToday ? 'text-blue-400 font-medium' : 'text-slate-400'}`}>
                              {displayDate(d)}
                              {isToday && (
                                <span className="ml-1.5 px-1.5 py-0.5 bg-blue-500 text-white rounded-full text-[10px]">Today</span>
                              )}
                            </div>
                          </td>
                          {SHIFTS.map((s) => {
                            const ct = cellMap[`${dateStr}|${s.value}`];
                            const style = ct ? CONSTRAINT_COLOR[ct] : null;
                            return (
                              <td key={s.value} className="px-3 py-4 text-center">
                                {style ? (
                                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${style.bg} ${style.text}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                                    {style.label}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 text-xs">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Summary counts for the week */}
          {selectedId && !loadingCons && (
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(CONSTRAINT_COLOR).map(([k, v]) => {
                const count = weekDates.reduce((acc, d) => {
                  return acc + SHIFTS.filter((s) => cellMap[`${toDateStr(d)}|${s.value}`] === k).length;
                }, 0);
                return (
                  <div key={k} className={`card p-4 flex items-center gap-3`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${v.bg}`}>
                      <span className={`w-3 h-3 rounded-full ${v.dot}`} />
                    </div>
                    <div>
                      <div className={`text-lg font-bold ${v.text}`}>{count}</div>
                      <div className="text-xs text-slate-500">{v.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
