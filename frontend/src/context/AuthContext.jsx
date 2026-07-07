import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (token) {
      api
        .get('/auth/me')
        .then((res) => {
          setUser(res.data);
          sessionStorage.setItem('user', JSON.stringify(res.data));
        })
        .catch(() => {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);
    const res = await api.post('/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    sessionStorage.setItem('token', res.data.access_token);
    const me = await api.get('/auth/me');
    setUser(me.data);
    sessionStorage.setItem('user', JSON.stringify(me.data));
    return me.data;
  };

  // Password-less demo login as a specific user
  const quickLogin = async (userId) => {
    const res = await api.post('/auth/quick-login', { user_id: userId });
    sessionStorage.setItem('token', res.data.access_token);
    const me = await api.get('/auth/me');
    setUser(me.data);
    sessionStorage.setItem('user', JSON.stringify(me.data));
    return me.data;
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, quickLogin, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
