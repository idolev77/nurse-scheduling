import { useState, useEffect } from 'react';
import { format, startOfWeek, addDays, parseISO, isToday } from 'date-fns';
import { FiCalendar, FiZap, FiCheckCircle, FiAlertCircle, FiSun, FiMoon, FiBriefcase, FiX, FiAward } from 'react-icons/fi';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const SHIFTS = [
  { key: 'morning',   label: 'Morning',   time: '07:00–15:00', icon: FiSun,     badge: 'badge-morning',   row: 'bg-amber-50/40' },
  { key: 'afternoon', label: 'Afternoon', time: '15:00–23:00', icon: FiBriefcase, badge: 'badge-afternoon', row: 'bg-orange-50/40' },
  { key: 'night',     label: 'Night',     time: '23:00–07:00', icon: FiMoon,    badge: 'badge-night',     row: 'bg-violet-50/40' },
];

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

  useEffect(() => {
    api.get('/departments/').then((res) => {
      setDepartments(res.data);
      if (res.data.length > 0) setSelectedDept(res.data[0].id);
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
    checkShifts();
    api
      .get('/schedules/', { params: { department_id: selectedDept } })
      .then((res) => {
        const match = res.data.find((s) => s.week_start_date === weekStart);
        setSchedule(match || null);
      });
  }, [selectedDept, weekStart]);

  const handlePrepareShifts = async () => {
    setPreparingShifts(true);
    setMessage({ text: '', type: '' });
    try {
      await api.post('/shifts/generate-week', {
        department_id: Number(selectedDept),
        week_start_date: weekStart,
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
          <button
            onClick={handlePrepareShifts}
            disabled={preparingShifts || shiftsReady}
            className="btn btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title={shiftsReady ? 'Shifts already prepared' : 'Prepare shift slots for the week'}
          >
            {preparingShifts ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Preparing…
              </>
            ) : shiftsReady ? (
              <><FiCheckCircle size={16} /> Shifts Ready</>
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
