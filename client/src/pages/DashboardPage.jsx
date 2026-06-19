import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { SNIPPET_SERVICE_URL } from '../config';
import { Plus, LogIn, History, LogOut, Code, User, Calendar, Users, FileText } from 'lucide-react';

export default function DashboardPage({ user, onJoinRoom, onLogout }) {
  const [roomId, setRoomId] = useState('');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState('');

  // Fetch session history for user
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await axios.get(`${SNIPPET_SERVICE_URL}/api/snippets/history/user`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setHistory(res.data);
      } catch (err) {
        console.error('Error fetching room history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, []);

  const handleCreateRoom = () => {
    // Generate a unique 8-character uppercase room ID
    const randomId = Math.random().toString(36).substring(2, 10).toUpperCase();
    onJoinRoom(randomId);
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!roomId.trim()) {
      setError('Please enter a valid Room ID.');
      return;
    }
    onJoinRoom(roomId.trim().toUpperCase());
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-white p-6 md:p-12 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-6 mb-10 gap-4">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-tr from-violet-600 to-blue-500 p-2 rounded-lg">
            <Code size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">CodeSync</h1>
            <p className="text-xs text-slate-400">Dashboard</p>
          </div>
        </div>

        {/* User Badge */}
        <div className="flex items-center space-x-4 bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5 pl-4 pr-4 shadow-xl backdrop-blur-md">
          <div className="flex items-center space-x-2.5">
            <div 
              className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-md shadow-violet-500/20" 
              style={{ backgroundColor: user.color }} 
            />
            <div className="text-sm font-semibold">{user.username}</div>
          </div>
          <div className="h-4 w-px bg-slate-800" />
          <button 
            onClick={onLogout}
            className="text-slate-400 hover:text-red-400 transition-colors flex items-center space-x-1 text-xs font-semibold cursor-pointer"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column - Room Creation / Joining */}
        <div className="lg:col-span-1 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="backdrop-blur-xl bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-2xl space-y-6"
          >
            <h2 className="text-lg font-bold tracking-wide text-slate-200">Start Session</h2>
            
            {/* Create Room Button */}
            <button
              onClick={handleCreateRoom}
              className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-blue-500 hover:from-violet-500 hover:to-blue-400 text-white rounded-xl font-bold text-sm shadow-lg shadow-violet-500/10 hover:shadow-violet-500/20 flex justify-center items-center space-x-2 transition-all cursor-pointer"
            >
              <Plus size={18} />
              <span>Create New Room</span>
            </button>

            <div className="flex items-center my-4">
              <div className="flex-1 h-px bg-slate-800" />
              <span className="px-3 text-xs text-slate-500 uppercase tracking-widest font-semibold">Or Join Room</span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            {/* Join Room Form */}
            <form onSubmit={handleJoinRoom} className="space-y-4">
              {error && (
                <div className="text-xs text-red-400 bg-red-950/20 border border-red-900/50 rounded-lg p-2.5 flex items-center space-x-1.5">
                  <span className="font-semibold">Error:</span>
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => {
                    setRoomId(e.target.value);
                    setError('');
                  }}
                  placeholder="ENTER ROOM ID (e.g. X8J9KL23)"
                  className="w-full bg-[#0E131F] border border-slate-800 rounded-xl py-3 px-4 text-slate-100 placeholder-slate-600 uppercase tracking-widest text-center focus:outline-none focus:border-violet-500/70 focus:ring-2 focus:ring-violet-500/10 transition-all font-mono text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl font-bold text-sm border border-slate-700/60 flex justify-center items-center space-x-2 transition-all cursor-pointer"
              >
                <LogIn size={18} />
                <span>Join Existing Room</span>
              </button>
            </form>
          </motion.div>
        </div>

        {/* Right column - Past Session History */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="backdrop-blur-xl bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-2xl min-h-[400px] flex flex-col"
          >
            <div className="flex items-center space-x-2 mb-6">
              <History className="text-violet-400" size={20} />
              <h2 className="text-lg font-bold tracking-wide text-slate-200">Room Histories</h2>
            </div>

            {loadingHistory ? (
              <div className="flex-1 flex flex-col justify-center items-center text-slate-500 space-y-3">
                <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin" />
                <span className="text-xs font-medium">Retrieving saved sessions...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="flex-1 flex flex-col justify-center items-center text-center p-8 border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                <FileText size={36} className="text-slate-700 mb-3" />
                <h3 className="text-sm font-semibold text-slate-400 mb-1">No session history found</h3>
                <p className="text-xs text-slate-600 max-w-xs">
                  Create or join a room. Any collaborative history saved by room admins will appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
                {history.map((session, index) => (
                  <motion.div
                    key={session._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => onJoinRoom(session.roomId)}
                    className="group bg-slate-950/40 hover:bg-slate-950/80 border border-slate-850 hover:border-slate-700/60 rounded-xl p-4.5 shadow-md flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.01]"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-violet-950/60 text-violet-300 border border-violet-900/60 uppercase font-mono">
                          {session.roomId}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-900/60 border border-slate-800/80 px-2 py-0.5 rounded uppercase tracking-wider">
                          {session.language}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-200 group-hover:text-violet-400 transition-colors mb-2 line-clamp-1">
                        {session.sessionName}
                      </h4>
                    </div>

                    <div className="space-y-2 mt-4 pt-3 border-t border-slate-900/80 text-[11px] text-slate-400">
                      <div className="flex items-center space-x-1.5">
                        <Calendar size={12} className="text-slate-600" />
                        <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <Users size={12} className="text-slate-600" />
                        <span className="line-clamp-1">
                          {session.participants?.map(p => p.username).join(', ') || 'Anonymous'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
