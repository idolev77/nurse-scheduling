import { useState, useEffect } from 'react';
import { FiUsers, FiAlertCircle, FiUserPlus, FiX } from 'react-icons/fi';
import api from '../api';

const ROLE_BADGE = {
  nurse:      'badge bg-blue-100 text-blue-700 ring-blue-200',
  head_nurse: 'badge bg-purple-100 text-purple-700 ring-purple-200',
  admin:      'badge bg-rose-100 text-rose-700 ring-rose-200',
};

const ROLE_LABEL = { nurse: 'Nurse', head_nurse: 'Head Nurse', admin: 'Admin' };

const AVATAR_COLORS = [
  'from-blue-500 to-cyan-400',
  'from-violet-500 to-purple-400',
  'from-rose-500 to-pink-400',
  'from-amber-500 to-orange-400',
  'from-emerald-500 to-teal-400',
];

function getInitials(first = '', last = '') {
  return `${first[0] || ''}${last[0] || ''}`.toUpperCase();
}

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  role: 'nurse',
  department_id: '',
};

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [actionError, setActionError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    api.get('/users/').then((res) => setUsers(res.data));
    api.get('/departments/').then((res) => setDepartments(res.data));
  }, []);

  const reload = () => api.get('/users/').then((res) => setUsers(res.data));

  const handleRoleChange = async (userId, newRole) => {
    setActionError('');
    try {
      await api.put(`/users/${userId}`, { role: newRole });
      reload();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to update role');
    }
  };

  const handleDeptChange = async (userId, deptId) => {
    setActionError('');
    try {
      await api.put(`/users/${userId}`, { department_id: deptId ? Number(deptId) : null });
      reload();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to update department');
    }
  };

  const handleToggleActive = async (userId, isActive) => {
    setActionError('');
    try {
      await api.put(`/users/${userId}`, { is_active: !isActive });
      reload();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to update status');
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      const payload = {
        ...form,
        department_id: form.department_id ? Number(form.department_id) : null,
      };
      await api.post('/users/', payload);
      await reload();
      setShowAddModal(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to create user');
    } finally {
      setFormLoading(false);
    }
  };

  const activeCount = users.filter((u) => u.is_active).length;
  const nurseCount = users.filter((u) => u.role === 'nurse').length;
  const headCount  = users.filter((u) => u.role === 'head_nurse').length;

  return (
    <div className="animate-fade-in-up">
      {/* Page header */}
      <div className="page-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-blue-500 text-white shadow">
            <FiUsers size={20} />
          </span>
          <div>
            <h1 className="page-title">Manage Users</h1>
            <p className="page-subtitle">Edit roles, departments, and account status</p>
          </div>
        </div>
        <button
          onClick={() => { setShowAddModal(true); setFormError(''); setForm(EMPTY_FORM); }}
          className="btn-primary flex items-center gap-2"
        >
          <FiUserPlus size={16} /> Add User
        </button>
      </div>

      {actionError && (
        <div className="alert-error mb-4">
          <FiAlertCircle size={15} className="flex-shrink-0" /> {actionError}
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Users',  value: users.length,  color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { label: 'Active',       value: activeCount,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Nurses',       value: nurseCount,    color: 'text-sky-600',    bg: 'bg-sky-50'    },
          { label: 'Head Nurses',  value: headCount,     color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`card ${bg} border-0 flex items-center gap-3 py-4 px-5`}>
            <span className={`text-3xl font-extrabold ${color}`}>{value}</span>
            <span className="text-sm text-slate-500 font-medium leading-tight">{label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="section-title mb-0">All Staff</h2>
          <span className="text-xs text-slate-400">{users.length} users</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, idx) => (
                <tr key={u.id}>
                  {/* Avatar + name */}
                  <td>
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br ${AVATAR_COLORS[idx % AVATAR_COLORS.length]} text-white text-xs font-bold shrink-0 select-none shadow-sm`}
                      >
                        {getInitials(u.first_name, u.last_name)}
                      </span>
                      <div>
                        <div className="font-semibold text-slate-800 text-sm">
                          {u.first_name} {u.last_name}
                        </div>
                        <div className="text-xs text-slate-400">ID #{u.id}</div>
                      </div>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="text-slate-500">{u.email}</td>

                  {/* Role */}
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span className={ROLE_BADGE[u.role] || 'badge'}>{ROLE_LABEL[u.role] || u.role}</span>
                      <select
                        className="ml-1 text-xs border border-slate-200 rounded-md px-1.5 py-1 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      >
                        <option value="nurse">Nurse</option>
                        <option value="head_nurse">Head Nurse</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </td>

                  {/* Department */}
                  <td>
                    <select
                      className="field-select text-sm py-1.5"
                      value={u.department_id || ''}
                      onChange={(e) => handleDeptChange(u.id, e.target.value)}
                    >
                      <option value="">— None —</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </td>

                  {/* Active toggle */}
                  <td>
                    <button
                      onClick={() => handleToggleActive(u.id, u.is_active)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                        u.is_active
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {u.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FiUserPlus className="text-violet-600" /> Add New User
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <FiX size={18} />
              </button>
            </div>

            {formError && (
              <div className="alert-error mb-4">
                <FiAlertCircle size={14} className="flex-shrink-0" /> {formError}
              </div>
            )}

            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">First Name</label>
                  <input
                    className="field"
                    required
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Last Name</label>
                  <input
                    className="field"
                    required
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  className="field"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
                <input
                  type="password"
                  className="field"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                  <select
                    className="field-select"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="nurse">Nurse</option>
                    <option value="head_nurse">Head Nurse</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
                  <select
                    className="field-select"
                    value={form.department_id}
                    onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                  >
                    <option value="">— None —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 btn-primary disabled:opacity-60"
                >
                  {formLoading ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
