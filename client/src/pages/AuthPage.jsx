import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { AUTH_SERVICE_URL } from '../config';
import { Terminal, KeyRound, Mail, User, AlertCircle, Sparkles } from 'lucide-react';

export default function AuthPage({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        // Login request
        const res = await axios.post(`${AUTH_SERVICE_URL}/api/auth/login`, {
          credential: email || username, // credential can be either
          password
        });
        const { token, user } = res.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        onAuthSuccess(user);
      } else {
        // Registration request
        const res = await axios.post(`${AUTH_SERVICE_URL}/api/auth/register`, {
          username,
          email,
          password
        });
        const { token, user } = res.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        onAuthSuccess(user);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-white flex flex-col justify-center items-center relative overflow-hidden px-4">
      {/* Decorative ambient background glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex items-center space-x-3 mb-8"
      >
        <div className="bg-gradient-to-tr from-violet-600 to-blue-500 p-2.5 rounded-xl shadow-lg shadow-violet-500/20">
          <Terminal size={32} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-wider bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            CODESYNC
          </h1>
          <p className="text-xs text-slate-400 tracking-widest font-semibold uppercase">
            Distributed Code Studio
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md backdrop-blur-xl bg-slate-900/60 border border-slate-800 rounded-2xl shadow-2xl p-8 relative z-10"
      >
        {/* Toggle tabs */}
        <div className="flex border-b border-slate-800 mb-6 relative">
          <button
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`flex-1 py-3 text-center font-medium transition-colors ${
              isLogin ? 'text-violet-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`flex-1 py-3 text-center font-medium transition-colors ${
              !isLogin ? 'text-violet-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Account
          </button>
          <motion.div
            layoutId="activeTabUnderline"
            className="absolute bottom-0 h-0.5 bg-gradient-to-r from-violet-500 to-blue-500"
            animate={{ left: isLogin ? '0%' : '50%', width: '50%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.form
            key={isLogin ? 'login' : 'register'}
            initial={{ opacity: 0, x: isLogin ? -15 : 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isLogin ? 15 : -15 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center space-x-2 bg-red-950/40 border border-red-800/60 text-red-200 p-3 rounded-lg text-sm"
              >
                <AlertCircle size={18} className="flex-shrink-0 text-red-400" />
                <span>{error}</span>
              </motion.div>
            )}

            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="john_doe"
                    className="w-full bg-[#0E131F] border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500/70 focus:ring-2 focus:ring-violet-500/10 transition-all text-sm"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {isLogin ? 'Email or Username' : 'Email Address'}
              </label>
              <div className="relative">
                {isLogin ? (
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                ) : (
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                )}
                <input
                  type={isLogin ? 'text' : 'email'}
                  required
                  value={email} // reused for username/email in login
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isLogin ? "email or username" : "john@example.com"}
                  className="w-full bg-[#0E131F] border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500/70 focus:ring-2 focus:ring-violet-500/10 transition-all text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#0E131F] border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500/70 focus:ring-2 focus:ring-violet-500/10 transition-all text-sm"
                />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-blue-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-violet-500/10 active:opacity-90 transition-all disabled:opacity-50 flex justify-center items-center space-x-2 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>{isLogin ? 'Sign In to Workspace' : 'Initialize Account'}</span>
                </>
              )}
            </motion.button>
          </motion.form>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
