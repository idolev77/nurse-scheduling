import { useState, useEffect } from 'react';
import { format, startOfWeek, addDays, parseISO, isToday } from 'date-fns';
import { FiCalendar, FiZap, FiCheckCircle, FiAlertCircle, FiSun, FiMoon, FiBriefcase, FiX, FiAward, FiShare2 } from 'react-icons/fi';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const SHIFTS = [
  { key: 'morning',   label: 'Morning',   time: '07:00–15:00', icon: FiSun,     badge: 'badge-morning',   row: 'bg-amber-50/40' },
  { key: 'afternoon', label: 'Afternoon', time: '15:00–23:00', icon: FiBriefcase, badge: 'badge-afternoon', row: 'bg-orange-50/40' },
  { key: 'night',     label: 'Night',     time: '23:00–07:00', icon: FiMoon,    badge: 'badge-night',     row: 'bg-violet-50/40' },
];

// ─────────────────────────────────────────────────────────
//  Flow Network Visualisation (pure SVG, no extra deps)
// ─────────────────────────────────────────────────────────
const FLOW_SHIFT_COLORS = {
  morning:   { fill: '#fffbeb', stroke: '#f59e0b', text: '#92400e', edge: '#f59e0b' },
  afternoon: { fill: '#fff7ed', stroke: '#f97316', text: '#9a3412', edge: '#f97316' },
  night:     { fill: '#f5f3ff', stroke: '#8b5cf6', text: '#4c1d95', edge: '#8b5cf6' },
};

function FlowNetworkDiagram({ assignments }) {
  if (!assignments || assignments.length === 0) return null;

  const nurseMap = new Map();
  const shiftMap = new Map();
  const edges    = [];

  assignments.forEach((a) => {
    if (!nurseMap.has(a.nurse_id))
      nurseMap.set(a.nurse_id, { id: a.nurse_id, name: a.nurse_name || `#${a.nurse_id}` });
    const sk = `${a.date}|${a.shift_type}`;
    if (!shiftMap.has(sk))
      shiftMap.set(sk, { key: sk, date: a.date, type: a.shift_type });
    edges.push({ nurseId: a.nurse_id, shiftKey: sk, type: a.shift_type });
  });

  const nurses = [...nurseMap.values()];
  const shifts = [...shiftMap.values()].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const o = { morning: 0, afternoon: 1, night: 2 };
    return o[a.type] - o[b.type];
  });

  const NURSE_H = 26, NURSE_W = 108, NURSE_GAP = 8;
  const SHIFT_H = 26, SHIFT_W = 128, SHIFT_GAP = 8;
  const NODE_RX  = 7;
  const PAD_V    = 40;
  const SVG_W    = 720;

  const nurseAreaH = nurses.length * (NURSE_H + NURSE_GAP) - NURSE_GAP;
  const shiftAreaH = shifts.length * (SHIFT_H + SHIFT_GAP) - SHIFT_GAP;
  const contentH   = Math.max(nurseAreaH, shiftAreaH, 120);
  const SVG_H      = contentH + PAD_V * 2;

  const COL_SRC   = 38;
  const COL_NURSE = 96;
  const COL_SHIFT = SVG_W - 96 - SHIFT_W;  // 496
  const COL_SINK  = SVG_W - 38;             // 682
  const MID_Y     = SVG_H / 2;

  const getNurseY = (id) => {
    const i = nurses.findIndex((n) => n.id === id);
    return PAD_V + (contentH - nurseAreaH) / 2 + i * (NURSE_H + NURSE_GAP) + NURSE_H / 2;
  };
  const getShiftY = (key) => {
    const i = shifts.findIndex((s) => s.key === key);
    return PAD_V + (contentH - shiftAreaH) / 2 + i * (SHIFT_H + SHIFT_GAP) + SHIFT_H / 2;
  };
  const cubic = (x1, y1, x2, y2) => {
    const mx = (x1 + x2) / 2;
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  };

  return (
    <div className="mt-8 section-card">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow">
          <FiShare2 size={16} />
        </span>
        <div>
          <h2 className="section-title mb-0">Flow Network — Selected Schedule</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Solid edges&nbsp;= assigned (flow&nbsp;=&nbsp;1) · Dashed&nbsp;= capacity only (flow&nbsp;=&nbsp;0)
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2 mb-4 mt-3">
        {Object.entries(FLOW_SHIFT_COLORS).map(([type, c]) => (
          <span
            key={type}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
            style={{ background: c.fill, borderColor: c.stroke, color: c.text }}
          >
            <span style={{ width: 18, height: 3, background: c.edge, display: 'inline-block', borderRadius: 2 }} />
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-slate-200 bg-white text-slate-400">
          <svg width="18" height="6" style={{ display: 'inline-block' }}>
            <line x1="0" y1="3" x2="18" y2="3" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3,2" />
          </svg>
          Capacity (flow = 0)
        </span>
      </div>

      {/* Diagram */}
      <div className="overflow-x-auto rounded-2xl border border-slate-100" style={{ background: '#f8fafc' }}>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width="100%"
          style={{ display: 'block', minHeight: 180 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="fn-src" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e40af" />
              <stop offset="100%" stopColor="#0e7490" />
            </linearGradient>
            <linearGradient id="fn-snk" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0e7490" />
              <stop offset="100%" stopColor="#0f766e" />
            </linearGradient>
            <linearGradient id="fn-nurse" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e3a8a" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
            <filter id="fn-shadow" x="-10%" y="-20%" width="120%" height="140%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#00000018" />
            </filter>
          </defs>

          {/* Background */}
          <rect width={SVG_W} height={SVG_H} fill="#f8fafc" />

          {/* Column header labels */}
          {[
            [COL_SRC,                 'SOURCE'],
            [COL_NURSE + NURSE_W / 2, 'NURSES'],
            [COL_SHIFT + SHIFT_W / 2, 'SHIFT SLOTS'],
            [COL_SINK,                'SINK'],
          ].map(([x, lbl]) => (
            <text key={lbl} x={x} y={30} textAnchor="middle"
              fontSize="8" fontWeight="700" fill="#cbd5e1" letterSpacing="1.2">
              {lbl}
            </text>
          ))}

          {/* Column dividers */}
          {[COL_NURSE - 18, COL_SHIFT + SHIFT_W + 18].map((x) => (
            <line key={x} x1={x} y1={38} x2={x} y2={SVG_H - 12}
              stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,5" />
          ))}

          {/* Source → Nurse capacity edges (dashed grey) */}
          {nurses.map((n) => (
            <path key={`sn-${n.id}`}
              d={cubic(COL_SRC + 24, MID_Y, COL_NURSE, getNurseY(n.id))}
              fill="none" stroke="#94a3b8" strokeWidth="1.4"
              strokeDasharray="5,4" opacity="0.5" />
          ))}

          {/* Shift → Sink capacity edges (dashed, shift-coloured) */}
          {shifts.map((s) => (
            <path key={`st-${s.key}`}
              d={cubic(COL_SHIFT + SHIFT_W, getShiftY(s.key), COL_SINK - 24, MID_Y)}
              fill="none" stroke={FLOW_SHIFT_COLORS[s.type].edge}
              strokeWidth="1.4" strokeDasharray="5,4" opacity="0.4" />
          ))}

          {/* Nurse → Shift assignment edges (solid, coloured by type) */}
          {edges.map((e, i) => (
            <path key={`e-${i}`}
              d={cubic(COL_NURSE + NURSE_W, getNurseY(e.nurseId), COL_SHIFT, getShiftY(e.shiftKey))}
              fill="none" stroke={FLOW_SHIFT_COLORS[e.type].edge}
              strokeWidth="2.5" opacity="0.88" />
          ))}

          {/* Source node */}
          <circle cx={COL_SRC} cy={MID_Y} r="18" fill="url(#fn-src)" filter="url(#fn-shadow)" />
          <text x={COL_SRC} y={MID_Y + 4} textAnchor="middle"
            fontSize="12" fontWeight="800" fill="white">S</text>

          {/* Sink node */}
          <circle cx={COL_SINK} cy={MID_Y} r="18" fill="url(#fn-snk)" filter="url(#fn-shadow)" />
          <text x={COL_SINK} y={MID_Y + 4} textAnchor="middle"
            fontSize="12" fontWeight="800" fill="white">T</text>

          {/* Nurse nodes */}
          {nurses.map((n) => {
            const y   = getNurseY(n.id);
            const lbl = n.name.length > 16 ? n.name.slice(0, 15) + '…' : n.name;
            return (
              <g key={n.id} filter="url(#fn-shadow)">
                <rect x={COL_NURSE} y={y - NURSE_H / 2}
                  width={NURSE_W} height={NURSE_H} rx={NODE_RX} fill="url(#fn-nurse)" />
                <text x={COL_NURSE + NURSE_W / 2} y={y + 4}
                  textAnchor="middle" fontSize="9.5" fontWeight="600" fill="white">
                  {lbl}
                </text>
              </g>
            );
          })}

          {/* Shift nodes */}
          {shifts.map((s) => {
            const y   = getShiftY(s.key);
            const c   = FLOW_SHIFT_COLORS[s.type];
            const lbl = `${format(parseISO(s.date), 'EEE d/M')} · ${s.type.charAt(0).toUpperCase() + s.type.slice(1)}`;
            return (
              <g key={s.key} filter="url(#fn-shadow)">
                <rect x={COL_SHIFT} y={y - SHIFT_H / 2}
                  width={SHIFT_W} height={SHIFT_H} rx={NODE_RX}
                  fill={c.fill} stroke={c.stroke} strokeWidth="1.5" />
                <text x={COL_SHIFT + SHIFT_W / 2} y={y + 4}
                  textAnchor="middle" fontSize="9" fontWeight="600" fill={c.text}>
                  {lbl}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Footer stats */}
      <p className="text-xs text-slate-400 mt-2 text-right">
        {nurses.length} nurses · {shifts.length} shift slots · {edges.length} assignments
      </p>
    </div>
  );
}

export default function ManageSchedule() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [weekStart, setWeekStart] = useState(() => {
    const d = startOfWeek(new Date(), { weekStartsOn: 0 });
    return format(d, 'yyyy-MM-dd');
  });
  const [schedule, setSchedule] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [preparingShifts, setPreparingShifts] = useState(false);
  const [shiftsReady, setShiftsReady] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [totalRequired, setTotalRequired] = useState(0);
  const [totalAssigned, setTotalAssigned] = useState(0);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [iterationsLog, setIterationsLog] = useState([]);
  const [showIterationsModal, setShowIterationsModal] = useState(false);
  const [nursesMorning, setNursesMorning] = useState(2);
  const [nursesAfternoon, setNursesAfternoon] = useState(2);
  const [nursesNight, setNursesNight] = useState(1);

  useEffect(() => {
    api.get('/departments/').then((res) => {
      setDepartments(res.data);
      if (res.data.length > 0) {
        setSelectedDept(res.data[0].id);
        setNursesMorning(res.data[0].min_nurses_morning);
        setNursesAfternoon(res.data[0].min_nurses_afternoon);
        setNursesNight(res.data[0].min_nurses_night);
      }
    });
  }, []);

  // Check if shifts exist for the selected week
  const checkShifts = async () => {
    if (!selectedDept) return;
    try {
      const res = await api.get('/shifts/', {
        params: { department_id: selectedDept, week_start: weekStart },
      });
      setShiftsReady(res.data.length > 0);
    } catch {
      setShiftsReady(false);
    }
  };

  useEffect(() => {
    if (!selectedDept) return;
    const dept = departments.find((d) => d.id === Number(selectedDept));
    if (dept) {
      setNursesMorning(dept.min_nurses_morning);
      setNursesAfternoon(dept.min_nurses_afternoon);
      setNursesNight(dept.min_nurses_night);
    }
    checkShifts();
    api
      .get('/schedules/', { params: { department_id: selectedDept } })
      .then((res) => {
        const match = res.data.find((s) => s.week_start_date === weekStart);
        setSchedule(match || null);
      });
  }, [selectedDept, weekStart, departments]);

  const handlePrepareShifts = async () => {
    setPreparingShifts(true);
    setMessage({ text: '', type: '' });
    try {
      await api.post('/shifts/generate-week', {
        department_id: Number(selectedDept),
        week_start_date: weekStart,
        nurses_morning: Number(nursesMorning),
        nurses_afternoon: Number(nursesAfternoon),
        nurses_night: Number(nursesNight),
      });
      setShiftsReady(true);
      setMessage({ text: 'Shifts prepared! Nurses can now submit availability.', type: 'success' });
    } catch (err) {
      setMessage({ text: err.response?.data?.detail || 'Failed to prepare shifts', type: 'error' });
    } finally {
      setPreparingShifts(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setMessage({ text: '', type: '' });
    setWarnings([]);
    try {
      // Always sync required_staff before generating
      await api.post('/shifts/generate-week', {
        department_id: Number(selectedDept),
        week_start_date: weekStart,
        nurses_morning: Number(nursesMorning),
        nurses_afternoon: Number(nursesAfternoon),
        nurses_night: Number(nursesNight),
      });
      setShiftsReady(true);
      const res = await api.post('/schedules/generate', {
        department_id: Number(selectedDept),
        week_start_date: weekStart,
      });
      setSchedule(res.data.schedule);
      setWarnings(res.data.warnings || []);
      setTotalRequired(res.data.total_required || 0);
      setTotalAssigned(res.data.total_assigned || 0);
      setIterationsLog(res.data.iterations_log || []);
      setShowIterationsModal(true);
      const warnCount = (res.data.warnings || []).length;
      setMessage({
        text: warnCount > 0
          ? `Schedule generated with ${warnCount} unfilled shift(s). Assigned ${res.data.total_assigned}/${res.data.total_required} slots.`
          : `Schedule generated successfully! All ${res.data.total_required} slots filled.`,
        type: warnCount > 0 ? 'warning' : 'success',
      });
    } catch (err) {
      setMessage({ text: err.response?.data?.detail || 'Failed to generate schedule', type: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!schedule) return;
    try {
      const res = await api.put(`/schedules/${schedule.id}/publish`);
      setSchedule(res.data);
      setMessage({ text: 'Schedule published successfully!', type: 'success' });
    } catch (err) {
      setMessage({ text: err.response?.data?.detail || 'Failed to publish', type: 'error' });
    }
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(parseISO(weekStart), i));

  const getAssignments = (dayStr, shiftType) => {
    if (!schedule?.assignments) return [];
    return schedule.assignments.filter((a) => a.date === dayStr && a.shift_type === shiftType);
  };

  return (
    <>
    <div className="animate-fade-in-up">
      {/* Page header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow">
            <FiCalendar size={20} />
          </span>
          <div>
            <h1 className="page-title">Manage Schedule</h1>
            <p className="page-subtitle">Generate and publish weekly shift schedules</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="section-card mb-6">
        <h2 className="section-title">Schedule Controls</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="form-label">Department</label>
            <select
              className="field-select"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Week Starting</label>
            <input
              type="date"
              className="field"
              value={weekStart}
              onChange={(e) => {
                const d = startOfWeek(parseISO(e.target.value), { weekStartsOn: 0 });
                setWeekStart(format(d, 'yyyy-MM-dd'));
              }}
            />
          </div>
          <div>
            <label className="form-label flex items-center gap-1">
              <FiSun size={13} className="text-amber-500" /> Morning nurses
            </label>
            <input
              type="number" min="1" max="20"
              className="field"
              value={nursesMorning}
              onChange={(e) => setNursesMorning(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label flex items-center gap-1">
              <FiBriefcase size={13} className="text-orange-500" /> Afternoon nurses
            </label>
            <input
              type="number" min="1" max="20"
              className="field"
              value={nursesAfternoon}
              onChange={(e) => setNursesAfternoon(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label flex items-center gap-1">
              <FiMoon size={13} className="text-violet-500" /> Night nurses
            </label>
            <input
              type="number" min="1" max="20"
              className="field"
              value={nursesNight}
              onChange={(e) => setNursesNight(e.target.value)}
            />
          </div>
          <button
            onClick={handlePrepareShifts}
            disabled={preparingShifts}
            className="btn btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title={shiftsReady ? 'Update nurse counts for this week' : 'Prepare shift slots for the week'}
          >
            {preparingShifts ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Preparing…
              </>
            ) : shiftsReady ? (
              <><FiCheckCircle size={16} /> Update Shifts</>
            ) : (
              <><FiCalendar size={16} /> Prepare Shifts</>
            )}
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || !shiftsReady}
            className="btn btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title={!shiftsReady ? 'Prepare shifts first' : ''}
          >
            {generating ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating…
              </>
            ) : (
              <><FiZap size={16} /> Generate Schedule</>
            )}
          </button>
          {schedule && !schedule.is_published && (
            <button
              onClick={handlePublish}
              className="btn btn-success flex items-center justify-center gap-2"
            >
              <FiCheckCircle size={16} /> Publish Schedule
            </button>
          )}
        </div>

        {message.text && (
          <div className={`mt-4 ${message.type === 'error' ? 'alert-error' : message.type === 'warning' ? 'alert-error' : 'alert-success'} flex items-center gap-2`}>
            <FiAlertCircle size={16} className="shrink-0" />
            {message.text}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm font-semibold text-amber-800 mb-1">Unfilled Shifts ({warnings.length}):</p>
            <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Schedule table */}
      {schedule ? (
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-3 mb-4">
            <span className={schedule.is_published ? 'badge badge-approved' : 'badge badge-pending'}>
              {schedule.is_published ? 'Published' : 'Draft'}
            </span>
            <span className="text-sm text-slate-500">
              Week of {format(parseISO(weekStart), 'MMMM d, yyyy')}
            </span>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #0e7490 100%)' }}>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider w-36">
                      Shift
                    </th>
                    {days.map((d) => {
                      const today = isToday(d);
                      return (
                        <th key={d.toISOString()} className="px-3 py-4 text-center min-w-[110px]">
                          <div className={`inline-flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg ${
                            today ? 'bg-white/20 ring-1 ring-white/40' : ''
                          }`}>
                            <span className="text-xs font-semibold text-sky-300 uppercase tracking-wide">
                              {format(d, 'EEE')}
                            </span>
                            <span className={`text-sm font-bold ${today ? 'text-white' : 'text-slate-200'}`}>
                              {format(d, 'dd/MM')}
                            </span>
                            {today && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {SHIFTS.map(({ key, label, time, icon: Icon, badge, row }) => (
                    <tr key={key} className={row}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Icon size={14} className="text-slate-400" />
                          <div>
                            <div className="text-sm font-semibold text-slate-700">{label}</div>
                            <div className="text-xs text-slate-400">{time}</div>
                          </div>
                        </div>
                      </td>
                      {days.map((d) => {
                        const dayStr = format(d, 'yyyy-MM-dd');
                        const assigns = getAssignments(dayStr, key);
                        return (
                          <td key={dayStr} className="px-2 py-3 align-top text-center">
                            <div className="flex flex-col gap-1 items-center">
                              {assigns.length > 0 ? assigns.map((a) => (
                                <span key={a.id} className={`badge ${badge} text-[11px] w-full max-w-[100px] truncate`}>
                                  {a.nurse_name || `#${a.nurse_id}`}
                                </span>
                              )) : (
                                <span className="text-slate-300 text-xs">—</span>
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
          </div>
          <FlowNetworkDiagram assignments={schedule.assignments || []} />
        </div>
      ) : (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <FiCalendar size={32} className="text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium text-lg">No schedule for this week</p>
          <p className="text-slate-400 text-sm mt-1">Select a department and click <strong>Generate Schedule</strong> to create one.</p>
        </div>
      )}
    </div>

      {/* Iterations Modal */}
      {showIterationsModal && iterationsLog.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in-up">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col" style={{ maxHeight: '85vh' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #0e7490 100%)' }}>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/20">
                  <FiZap size={16} className="text-white" />
                </span>
                <div>
                  <h3 className="text-white font-semibold text-sm">Min-Cost Max-Flow</h3>
                  <p className="text-sky-300 text-xs">{iterationsLog.length} iterations completed</p>
                </div>
              </div>
              <button
                onClick={() => setShowIterationsModal(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <FiX size={20} />
              </button>
            </div>

            {/* Result banner */}
            <div className={`px-5 py-3 flex items-center gap-2 text-sm font-medium ${
              warnings.length > 0
                ? 'bg-amber-50 border-b border-amber-200 text-amber-800'
                : 'bg-emerald-50 border-b border-emerald-200 text-emerald-800'
            }`}>
              {warnings.length > 0 ? (
                <FiAlertCircle size={15} className="shrink-0" />
              ) : (
                <FiCheckCircle size={15} className="shrink-0" />
              )}
              {warnings.length > 0
                ? `Schedule generated with ${warnings.length} unfilled shift(s). Assigned ${totalAssigned}/${totalRequired} slots.`
                : `Schedule generated successfully! All ${totalRequired} slots filled.`}
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">#</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {iterationsLog.map((row) => (
                    <tr
                      key={row.iteration}
                      className={row.is_best
                        ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200'
                        : 'hover:bg-slate-50'}
                    >
                      <td className={`px-4 py-2 font-mono text-xs ${row.is_best ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                        {row.iteration}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`text-xs font-semibold ${
                          row.assigned === row.required ? 'text-emerald-700' : 'text-amber-600'
                        }`}>
                          {row.assigned}/{row.required}
                        </span>
                      </td>
                      <td className={`px-4 py-2 text-right font-mono text-xs ${row.is_best ? 'text-emerald-700 font-bold' : 'text-slate-600'}`}>
                        {row.score.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {row.is_best ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                            <FiAward size={11} /> Selected
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowIterationsModal(false)}
                className="btn btn-primary text-sm px-5 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
