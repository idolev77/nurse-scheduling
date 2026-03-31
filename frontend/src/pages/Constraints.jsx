import { useState, useEffect } from 'react';
import api from '../api';
import { FiPlus, FiTrash2, FiSliders, FiAlertCircle } from 'react-icons/fi';

const SHIFT_OPTIONS = [
  { value: 'morning',   label: 'Morning   (07:00 – 15:00)' },
  { value: 'afternoon', label: 'Afternoon (15:00 – 23:00)' },
  { value: 'night',     label: 'Night     (23:00 – 07:00)' },
];
const TYPE_OPTIONS = [
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

export default function Constraints() {
  const [constraints, setConstraints] = useState([]);
  const [form, setForm] = useState({ date: '', shift_type: 'morning', constraint_type: 'cannot_work', note: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchConstraints = () => {
    api.get('/constraints/').then((res) =>
      setConstraints([...res.data].sort((a, b) => a.date.localeCompare(b.date)))
    );
  };
  useEffect(fetchConstraints, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/constraints/', form);
      setForm({ date: '', shift_type: 'morning', constraint_type: 'cannot_work', note: '' });
      fetchConstraints();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add constraint');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    await api.delete(`/constraints/${id}`);
    fetchConstraints();
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <FiSliders className="text-amber-500" /> My Shift Constraints
        </h1>
        <p className="page-subtitle">Mark dates when you cannot work, prefer not to work, or prefer to work</p>
      </div>

      {/* Add form */}
      <div className="section-card">
        <h2 className="section-title">Add New Constraint</h2>
        {error && (
          <div className="alert-error">
            <FiAlertCircle size={15} className="flex-shrink-0" /> {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="form-label">Date</label>
            <input type="date" required className="field" value={form.date} onChange={update('date')} />
          </div>
          <div>
            <label className="form-label">Shift</label>
            <select className="field-select" value={form.shift_type} onChange={update('shift_type')}>
              {SHIFT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Type</label>
            <select className="field-select" value={form.constraint_type} onChange={update('constraint_type')}>
              {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Note <span className="text-slate-300 normal-case font-normal">(optional)</span></label>
            <input className="field" value={form.note} onChange={update('note')} placeholder="e.g. medical appointment" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            <FiPlus size={15} />
            {loading ? 'Adding…' : 'Add Constraint'}
          </button>
        </form>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="font-semibold text-slate-800 text-sm">
            All Constraints
            {constraints.length > 0 && (
              <span className="ml-2 badge bg-slate-100 text-slate-600">{constraints.length}</span>
            )}
          </span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Nurse</th>
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
                <td colSpan="6" className="px-5 py-12 text-center text-slate-400">
                  No constraints yet — add your first one above.
                </td>
              </tr>
            ) : (
              constraints.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium text-slate-700">{c.nurse_name || '—'}</td>
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
