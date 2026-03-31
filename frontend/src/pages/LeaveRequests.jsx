import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiCheck, FiX, FiClock, FiAlertCircle } from 'react-icons/fi';

export default function LeaveRequests() {
  const { user } = useAuth();
  const isManager = user && (user.role === 'head_nurse' || user.role === 'admin');
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ start_date: '', end_date: '', reason: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchRequests = () => {
    api.get('/leave-requests/').then((res) => setRequests(res.data));
  };
  useEffect(fetchRequests, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.end_date < form.start_date) {
      setError('End date must be on or after start date');
      return;
    }
    setLoading(true);
    try {
      await api.post('/leave-requests/', form);
      setForm({ start_date: '', end_date: '', reason: '' });
      fetchRequests();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id, status) => {
    await api.put(`/leave-requests/${id}/review`, { status });
    fetchRequests();
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const STATUS_BADGE = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected' };

  const pending = requests.filter((r) => r.status === 'pending').length;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <FiClock className="text-emerald-500" /> Leave Requests
        </h1>
        <p className="page-subtitle">Request time off and track your approval status</p>
      </div>

      {/* Submit form */}
      <div className="section-card">
        <h2 className="section-title">New Leave Request</h2>
        {error && (
          <div className="alert-error">
            <FiAlertCircle size={15} className="flex-shrink-0" /> {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="form-label">Start Date</label>
            <input type="date" required className="field" value={form.start_date} onChange={update('start_date')} />
          </div>
          <div>
            <label className="form-label">End Date</label>
            <input type="date" required className="field" value={form.end_date} onChange={update('end_date')} />
          </div>
          <div>
            <label className="form-label">Reason <span className="text-slate-300 normal-case font-normal">(optional)</span></label>
            <input className="field" value={form.reason} onChange={update('reason')} placeholder="e.g. family event" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            <FiPlus size={15} />
            {loading ? 'Submitting…' : 'Submit Request'}
          </button>
        </form>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="font-semibold text-slate-800 text-sm">
            All Requests
            {pending > 0 && (
              <span className="ml-2 badge-pending">{pending} pending</span>
            )}
          </span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Reason</th>
              <th>Status</th>
              {isManager && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan={isManager ? 5 : 4} className="py-12 text-center text-slate-400">
                  No leave requests yet.
                </td>
              </tr>
            ) : (
              requests.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.start_date}</td>
                  <td className="font-medium">{r.end_date}</td>
                  <td className="text-slate-500">{r.reason || <span className="text-slate-300">—</span>}</td>
                  <td>
                    <span className={STATUS_BADGE[r.status]}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                      {r.status}
                    </span>
                  </td>
                  {isManager && (
                    <td>
                      {r.status === 'pending' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleReview(r.id, 'approved')}
                            className="btn text-xs px-3 py-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg gap-1"
                            title="Approve"
                          >
                            <FiCheck size={13} /> Approve
                          </button>
                          <button
                            onClick={() => handleReview(r.id, 'rejected')}
                            className="btn text-xs px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg gap-1"
                            title="Reject"
                          >
                            <FiX size={13} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">Reviewed</span>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
