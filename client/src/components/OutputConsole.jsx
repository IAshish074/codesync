import React, { useState } from 'react';
import axios from 'axios';
import { Play, Terminal, AlertCircle, Clock, Cpu } from 'lucide-react';
import { SNIPPET_SERVICE_URL } from '../config';

// Map Monaco languages to Judge0 language IDs (Judge0 CE v4 endpoint)
const LANGUAGE_IDS = {
  javascript: 93, // Node.js
  typescript: 94, // TypeScript
  python: 71,     // Python 3
  java: 91,       // Java
  cpp: 54,        // C++ (GCC 9.2.0)
  c: 50,          // C (GCC 9.2.0)
  go: 60,         // Go
  ruby: 72,       // Ruby
  rust: 73,       // Rust
  csharp: 51      // C# (Mono)
};

export default function OutputConsole({ code, language }) {
  const [stdout, setStdout] = useState('');
  const [stderr, setStderr] = useState('');
  const [compileError, setCompileError] = useState('');
  const [stdin, setStdin] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  const runCode = async () => {
    setLoading(true);
    setStdout('');
    setStderr('');
    setCompileError('');
    setStats(null);

    const languageId = LANGUAGE_IDS[language];
    if (!languageId) {
      setStderr(`Execution is not supported for "${language}". Try python, javascript, cpp, rust, etc.`);
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const url = `${SNIPPET_SERVICE_URL}/api/snippets/compile`;
      const payload = {
        code,
        languageId,
        stdin
      };

      const res = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = res.data;

      // Extract results
      if (data.stdout) {
        setStdout(data.stdout);
      }
      if (data.stderr) {
        setStderr(data.stderr);
      }
      if (data.compile_output) {
        setCompileError(data.compile_output);
      }

      if (!data.stdout && !data.stderr && !data.compile_output) {
        setStdout('[Process executed successfully with no output stdout]');
      }

      setStats({
        time: data.time || '0.000',
        memory: data.memory || 0,
        statusName: data.status?.description || 'Finished'
      });

    } catch (err) {
      console.error(err);
      setStderr(err.response?.data?.message || err.message || 'Network error executing code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl relative">
      {/* Header */}
      <div className="p-4 bg-slate-950/40 border-b border-slate-850 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <Terminal size={18} className="text-violet-400" />
          <span className="text-sm font-bold tracking-wide">Execution Console</span>
        </div>
        
        <button
          onClick={runCode}
          disabled={loading}
          className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-lg shadow-md hover:shadow-emerald-500/10 text-xs font-bold flex items-center space-x-1.5 transition-all disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Play size={12} fill="white" />
              <span>Run Code</span>
            </>
          )}
        </button>
      </div>

      <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin">
        {/* Input Stdin box */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Standard Input (stdin)
          </label>
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="Type inputs for your script here..."
            rows={2}
            className="w-full bg-[#0E131F] border border-slate-800 rounded-xl p-3 text-xs placeholder-slate-700 focus:outline-none focus:border-violet-500/70 transition-all font-mono text-slate-200"
          />
        </div>

        {/* Stats segment */}
        {stats && (
          <div className="grid grid-cols-3 gap-2 bg-slate-950/30 border border-slate-850 p-2.5 rounded-xl text-[10px] font-medium text-slate-400">
            <div className="flex items-center space-x-1.5">
              <AlertCircle size={12} className="text-violet-400" />
              <span>{stats.statusName}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Clock size={12} className="text-blue-400" />
              <span>{stats.time} s</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Cpu size={12} className="text-emerald-400" />
              <span>{(stats.memory / 1024).toFixed(1)} MB</span>
            </div>
          </div>
        )}

        {/* Output Terminal box */}
        <div className="flex-1 flex flex-col min-h-[160px] bg-black/60 border border-slate-850 rounded-xl p-3.5 font-mono text-xs overflow-y-auto">
          <span className="text-[9px] font-bold text-slate-600 mb-2 uppercase tracking-wider block">Terminal Output</span>
          
          {loading && (
            <div className="flex items-center space-x-2 text-slate-500 py-1">
              <span className="animate-pulse">Compiling & executing sandbox run...</span>
            </div>
          )}

          {compileError && (
            <pre className="text-red-400 whitespace-pre-wrap select-text mb-2 bg-red-950/10 border border-red-900/20 p-2.5 rounded-lg">
              {compileError}
            </pre>
          )}

          {stderr && (
            <pre className="text-amber-400 whitespace-pre-wrap select-text mb-2 bg-amber-950/10 border border-amber-900/20 p-2.5 rounded-lg">
              {stderr}
            </pre>
          )}

          {stdout && (
            <pre className="text-emerald-400 whitespace-pre-wrap select-text">
              {stdout}
            </pre>
          )}

          {!stdout && !stderr && !compileError && !loading && (
            <span className="text-slate-700 italic">No output. Press "Run Code" to execute.</span>
          )}
        </div>
      </div>
    </div>
  );
}
