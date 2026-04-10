import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ScheduleView from './pages/ScheduleView';
import Constraints from './pages/Constraints';
import LeaveRequests from './pages/LeaveRequests';
import ManageSchedule from './pages/ManageSchedule';
import ManageUsers from './pages/ManageUsers';
import ShiftHoursSummaryPage from './pages/ShiftHoursSummaryPage';
import SwapMarketplace from './pages/SwapMarketplace';
import AllConstraints from './pages/AllConstraints';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex justify-center p-10">Loading...</div>;
  return user ? children : <Navigate to="/login" />;
}

function ManagerRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex justify-center p-10">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'nurse') return <Navigate to="/dashboard" />;
  return children;
}

export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/schedule" element={<PrivateRoute><ScheduleView /></PrivateRoute>} />
          <Route path="/constraints" element={<PrivateRoute><Constraints /></PrivateRoute>} />
          <Route path="/leave-requests" element={<PrivateRoute><LeaveRequests /></PrivateRoute>} />
          <Route path="/shift-summary" element={<PrivateRoute><ShiftHoursSummaryPage /></PrivateRoute>} />
          <Route path="/swap-marketplace" element={<PrivateRoute><SwapMarketplace /></PrivateRoute>} />
          <Route path="/manage/schedule" element={<ManagerRoute><ManageSchedule /></ManagerRoute>} />
          <Route path="/manage/users" element={<ManagerRoute><ManageUsers /></ManagerRoute>} />
          <Route path="/manage/constraints" element={<ManagerRoute><AllConstraints /></ManagerRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </main>
    </div>
  );
}
