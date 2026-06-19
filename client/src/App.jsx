import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AUTH_SERVICE_URL } from './config';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import EditorPage from './pages/EditorPage';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentRoomId, setCurrentRoomId] = useState(null);

  // Authenticate user on page load
  useEffect(() => {
    const authenticate = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await axios.get(`${AUTH_SERVICE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(res.data);
      } catch (err) {
        console.error('Session validation failed, clearing token.', err);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    authenticate();
  }, []);

  const handleAuthSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setCurrentRoomId(null);
  };

  const handleJoinRoom = (roomId) => {
    setCurrentRoomId(roomId);
  };

  const handleBackToDashboard = () => {
    setCurrentRoomId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090D16] text-white flex flex-col justify-center items-center space-y-4">
        <div className="w-10 h-10 border-4 border-violet-500/25 border-t-violet-400 rounded-full animate-spin" />
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 animate-pulse">
          Synchronizing Workspace...
        </span>
      </div>
    );
  }

  // --- ROUTING DECISION ---
  if (!user) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  if (currentRoomId) {
    return (
      <EditorPage
        user={user}
        roomId={currentRoomId}
        onBackToDashboard={handleBackToDashboard}
      />
    );
  }

  return (
    <DashboardPage
      user={user}
      onJoinRoom={handleJoinRoom}
      onLogout={handleLogout}
    />
  );
}
