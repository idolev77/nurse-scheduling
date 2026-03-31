import { useState, useEffect } from 'react';
import { FiUsers } from 'react-icons/fi';
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

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    api.get('/users/').then((res) => setUsers(res.data));
    api.get('/departments/').then((res) => setDepartments(res.data));
  }, []);

  const reload = () => api.get('/users/').then((res) => setUsers(res.data));

  const handleRoleChange = async (userId, newRole) => {
    await api.put(`/users/${userId}`, { role: newRole });
    reload();
  };

  const handleDeptChange = async (userId, deptId) => {
    await api.put(`/users/${userId}`, { department_id: deptId ? Number(deptId) : null });
    reload();
  };

  const handleToggleActive = async (userId, isActive) => {
    await api.put(`/users/${userId}`, { is_active: !isActive });
    reload();
  };

  const activeCount = users.filter((u) => u.is_active).length;
  const nurseCount = users.filter((u) => u.role === 'nurse').length;
  const headCount  = users.filter((u) => u.role === 'head_nurse').length;

  return (
    <div className="animate-fade-in-up">
      {/* Page header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-blue-500 text-white shadow">
            <FiUsers size={20} />
          </span>
          <div>
            <h1 className="page-title">Manage Users</h1>
            <p className="page-subtitle">Edit roles, departments, and account status</p>
          </div>
        </div>
      </div>

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
    </div>
  );
}
