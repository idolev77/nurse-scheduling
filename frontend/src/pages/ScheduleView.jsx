import { useState, useEffect } from 'react';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { FiChevronLeft, FiChevronRight, FiCalendar, FiSun, FiClock, FiMoon } from 'react-icons/fi';

const SHIFTS = [
  { key: 'morning',   label: 'Morning',   time: '07:00 – 15:00', icon: <FiSun size={14} />,    badge: 'badge-morning',   bg: 'bg-amber-50',   header: 'bg-amber-500' },
  { key: 'afternoon', label: 'Afternoon', time: '15:00 – 23:00', icon: <FiClock size={14} />,  badge: 'badge-afternoon', bg: 'bg-orange-50',  header: 'bg-orange-500' },
  { key: 'night',     label: 'Night',     time: '23:00 – 07:00', icon: <FiMoon size={14} />,   badge: 'badge-night',     bg: 'bg-violet-50',  header: 'bg-violet-600' },
];

export default function ScheduleView() {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState(null);
  const [weekStart, setWeekStart] = useState(() =>
    format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd')
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get('/schedules/', { params: { department_id: user?.department_id } })
      .then((res) => {
        const match = res.data.find((s) => s.week_start_date === weekStart);
        setSchedule(match || null);
      })
      .catch(() => setSchedule(null))
      .finally(() => setLoading(false));
  }, [weekStart, user]);

  const shiftWeek = (delta) => {
    const d = addDays(parseISO(weekStart), delta * 7);
    setWeekStart(format(d, 'yyyy-MM-dd'));
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(parseISO(weekStart), i));

  const getAssignments = (dayStr, shiftKey) =>
    schedule?.assignments.filter((a) => a.date === dayStr && a.shift_type === shiftKey) ?? [];

  const weekLabel = `${format(parseISO(weekStart), 'MMM d')} – ${format(addDays(parseISO(weekStart), 6), 'MMM d, yyyy')}`;

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="page-header mb-0">
          <h1 className="page-title flex items-center gap-2">
            <FiCalendar className="text-blue-500" /> Weekly Schedule
          </h1>
          <p className="page-subtitle">{weekLabel}</p>
        </div>

        {/* Week navigator */}
        <div className="flex items-center gap-2">
          <button onClick={() => shiftWeek(-1)} className="btn-ghost px-3 py-2">
            <FiChevronLeft size={18} />
          </button>
          <input
            type="date"
            className="field text-sm w-40"
            value={weekStart}
            onChange={(e) => {
              const d = startOfWeek(parseISO(e.target.value), { weekStartsOn: 0 });
              setWeekStart(format(d, 'yyyy-MM-dd'));
            }}
          />
          <button onClick={() => shiftWeek(1)} className="btn-ghost px-3 py-2">
            <FiChevronRight size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card p-16 text-center text-slate-400">
          <div className="animate-pulse text-lg font-medium">Loading schedule…</div>
        </div>
      ) : !schedule ? (
        <div className="card p-16 text-center">
          <FiCalendar size={40} className="text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">No published schedule for this week.</p>
          <p className="text-slate-400 text-sm mt-1">Check back after the head nurse publishes the schedule.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl shadow" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.07)' }}>
          <table className="w-full text-sm bg-white rounded-2xl overflow-hidden">
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #0e7490 100%)' }}>
                <th className="px-5 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider w-36">Shift</th>
                {days.map((d) => {
                  const isToday = format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                  return (
                    <th key={d.toISOString()} className="px-3 py-4 text-center">
                      <div className={`text-[11px] font-medium uppercase tracking-wider ${isToday ? 'text-sky-300' : 'text-slate-400'}`}>
                        {format(d, 'EEE')}
                      </div>
                      <div
                        className={`text-base font-bold mt-0.5 ${ isToday ? 'text-sky-300' : 'text-white'}`}
                      >
                        {format(d, 'd')}
                      </div>
                      {isToday && (
                        <div className="w-1.5 h-1.5 rounded-full bg-sky-400 mx-auto mt-1" />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {SHIFTS.map((shift, si) => (
                <tr key={shift.key} className={si < SHIFTS.length - 1 ? 'border-b border-slate-100' : ''}>
                  {/* Shift label */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`${shift.badge} flex items-center gap-1`}>
                        {shift.icon} {shift.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">{shift.time}</div>
                  </td>

                  {days.map((d) => {
                    const dayStr = format(d, 'yyyy-MM-dd');
                    const assigns = getAssignments(dayStr, shift.key);
                    const isToday = dayStr === format(new Date(), 'yyyy-MM-dd');

                    return (
                      <td
                        key={dayStr}
                        className={`px-2 py-3 text-center align-top ${isToday ? shift.bg : ''}`}
                      >
                        <div className="flex flex-col gap-1 items-center">
                          {assigns.map((a) => (
                            <span
                              key={a.id}
                              className={`${shift.badge} text-[11px] px-2 py-0.5 max-w-[90px] truncate block
                                ${a.nurse_id === user?.id ? 'ring-2 ring-offset-1 ring-blue-400 font-bold' : ''}`}
                              title={a.nurse_name}
                            >
                              {a.nurse_name?.split(' ')[0] || `#${a.nurse_id}`}
                            </span>
                          ))}
                          {assigns.length === 0 && (
                            <span className="text-slate-200 text-xs select-none">—</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 flex-wrap">
        {SHIFTS.map((s) => (
          <span key={s.key} className={`${s.badge} text-xs`}>
            {s.icon} {s.label} • {s.time}
          </span>
        ))}
        <span className="text-xs text-slate-400 ml-auto">Your shifts are highlighted with a blue ring</span>
      </div>
    </div>
  );
}
