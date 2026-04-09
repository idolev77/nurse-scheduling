import { useState, useEffect } from 'react';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import { FiCheckCircle, FiAlertCircle, FiSend, FiSun, FiMoon, FiBriefcase } from 'react-icons/fi';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const SHIFT_META = {
  morning:   { label: 'Morning',   time: '07:00–15:00', icon: FiSun,       color: 'text-amber-500' },
  afternoon: { label: 'Afternoon', time: '15:00–23:00', icon: FiBriefcase, color: 'text-orange-500' },
  night:     { label: 'Night',     time: '23:00–07:00', icon: FiMoon,      color: 'text-violet-500' },
};

const PREF_OPTIONS = [
  { value: 0,  label: '—',                  bg: 'bg-slate-50',   text: 'text-slate-400' },
  { value: 1,  label: 'Preferred',          bg: 'bg-emerald-50', text: 'text-emerald-700' },
  { value: 2,  label: 'Available if needed', bg: 'bg-amber-50',  text: 'text-amber-700' },
];

export default function Availability() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [weekStart, setWeekStart] = useState(() => {
    const d = startOfWeek(new Date(), { weekStartsOn: 0 });
    return format(d, 'yyyy-MM-dd');
  });
  const [shifts, setShifts] = useState([]);
  const [selections, setSelections] = useState({}); // { shiftId: preferenceLevel (1|2) }
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Load departments
  useEffect(() => {
    api.get('/departments/').then((res) => {
      setDepartments(res.data);
      if (user?.department_id) {
        setSelectedDept(user.department_id);
      } else if (res.data.length > 0) {
        setSelectedDept(res.data[0].id);
      }
    });
  }, [user]);

  // Load shifts + existing availability for the selected week
  useEffect(() => {
    if (!selectedDept) return;
    const loadData = async () => {
      try {
        const [shiftsRes, availRes] = await Promise.all([
          api.get('/shifts/', { params: { department_id: selectedDept, week_start: weekStart } }),
          api.get('/availability/', { params: { department_id: selectedDept, week_start: weekStart } }),
        ]);
        setShifts(shiftsRes.data);

        // Build selections map from existing availability
        const sel = {};
        for (const a of availRes.data) {
          sel[a.shift_id] = a.preference_level;
        }
        setSelections(sel);
      } catch {
        setShifts([]);
        setSelections({});
      }
    };
    loadData();
  }, [selectedDept, weekStart]);

  const togglePref = (shiftId, newPref) => {
    setSelections((prev) => {
      const copy = { ...prev };
      if (copy[shiftId] === newPref) {
        delete copy[shiftId]; // deselect
      } else {
        copy[shiftId] = newPref;
      }
      return copy;
    });
  };

  const handleSubmit = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const items = Object.entries(selections).map(([shiftId, pref]) => ({
        shift_id: Number(shiftId),
        preference_level: pref,
        capacity: 1,
      }));
      await api.post('/availability/bulk', { items });
      setMessage({ text: `Availability saved (${items.length} shifts).`, type: 'success' });
    } catch (err) {
      setMessage({ text: err.response?.data?.detail || 'Failed to save availability', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Group shifts by date for the grid
  const days = Array.from({ length: 7 }, (_, i) => addDays(parseISO(weekStart), i));
  const shiftsByDateType = {};
  for (const s of shifts) {
    shiftsByDateType[`${s.date}_${s.shift_type}`] = s;
  }

  const selectedCount = Object.keys(selections).length;

  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow">
            <FiCheckCircle size={20} />
          </span>
          <div>
            <h1 className="page-title">Shift Availability</h1>
            <p className="page-subtitle">Mark which shifts you can work and your preference level</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="section-card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
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
            onClick={handleSubmit}
            disabled={saving || selectedCount === 0}
            className="btn btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              <><FiSend size={16} /> Submit Availability ({selectedCount})</>
            )}
          </button>
        </div>

        {message.text && (
          <div className={`mt-4 ${message.type === 'error' ? 'alert-error' : 'alert-success'} flex items-center gap-2`}>
            <FiAlertCircle size={16} className="shrink-0" />
            {message.text}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        {PREF_OPTIONS.map((p) => (
          <span key={p.value} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${p.bg} ${p.text} font-medium`}>
            <span className={`w-2 h-2 rounded-full ${p.value === 0 ? 'bg-slate-300' : p.value === 1 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {p.value === 0 ? 'Not available' : p.label}
          </span>
        ))}
      </div>

      {/* Availability grid */}
      {shifts.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">
          <p className="text-lg font-medium mb-1">No shifts available</p>
          <p className="text-sm">Shifts have not been prepared for this week yet. Please check back later.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #0e7490 100%)' }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider w-36">
                    Shift
                  </th>
                  {days.map((d) => (
                    <th key={d.toISOString()} className="px-3 py-3 text-center min-w-[120px]">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-xs font-semibold text-sky-300 uppercase">{format(d, 'EEE')}</span>
                        <span className="text-sm font-bold text-slate-200">{format(d, 'dd/MM')}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(SHIFT_META).map(([key, meta]) => {
                  const Icon = meta.icon;
                  return (
                    <tr key={key} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Icon size={14} className={meta.color} />
                          <div>
                            <div className="text-sm font-semibold text-slate-700">{meta.label}</div>
                            <div className="text-xs text-slate-400">{meta.time}</div>
                          </div>
                        </div>
                      </td>
                      {days.map((d) => {
                        const dayStr = format(d, 'yyyy-MM-dd');
                        const shift = shiftsByDateType[`${dayStr}_${key}`];
                        if (!shift) {
                          return (
                            <td key={dayStr} className="px-2 py-3 text-center">
                              <span className="text-xs text-slate-300">—</span>
                            </td>
                          );
                        }
                        const current = selections[shift.id] || 0;
                        return (
                          <td key={dayStr} className="px-2 py-3 text-center">
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => togglePref(shift.id, 1)}
                                className={`text-xs px-2 py-1 rounded-md font-medium transition-all ${
                                  current === 1
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-700'
                                }`}
                              >
                                Preferred
                              </button>
                              <button
                                onClick={() => togglePref(shift.id, 2)}
                                className={`text-xs px-2 py-1 rounded-md font-medium transition-all ${
                                  current === 2
                                    ? 'bg-amber-500 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-500 hover:bg-amber-100 hover:text-amber-700'
                                }`}
                              >
                                If needed
                              </button>
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
        </div>
      )}
    </div>
  );
}
