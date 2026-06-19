import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, MessageSquare, Terminal } from 'lucide-react';

export default function ChatPanel({ messages, onSendMessage, currentUser }) {
  const [text, setText] = useState('');
  const messagesEndRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl relative">
      {/* Header */}
      <div className="p-4 bg-slate-950/40 border-b border-slate-850 flex items-center space-x-2.5">
        <MessageSquare size={18} className="text-violet-400" />
        <span className="text-sm font-bold tracking-wide">Room Chat</span>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[calc(100vh-320px)] md:max-h-[calc(100vh-280px)] scrollbar-thin">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center text-center p-6 text-slate-500 space-y-2">
            <MessageSquare size={32} className="text-slate-800" />
            <p className="text-xs">No messages yet. Send a greeting to start collaborating!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isSystem = msg.sender === 'System';
            const isMe = msg.sender === currentUser.username;

            if (isSystem) {
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex justify-center"
                >
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-950/40 border border-slate-900/60 px-3 py-1 rounded-full uppercase tracking-wider flex items-center space-x-1.5 shadow-sm">
                    <Terminal size={10} className="text-slate-600" />
                    <span>{msg.text}</span>
                  </span>
                </motion.div>
              );
            }

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-baseline space-x-2 mb-1">
                  <span className={`text-[10px] font-bold ${isMe ? 'text-violet-400' : 'text-blue-400'}`}>
                    {msg.sender}
                  </span>
                  <span className="text-[9px] text-slate-500">{msg.timestamp}</span>
                </div>
                
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-2.5 text-xs leading-relaxed shadow-md ${
                    isMe
                      ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-tr-none'
                      : 'bg-slate-800 text-slate-200 border border-slate-750 rounded-tl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="p-3 bg-slate-950/40 border-t border-slate-850 flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type message..."
          className="flex-1 bg-[#0E131F] border border-slate-800 focus:outline-none focus:border-violet-500/70 focus:ring-1 focus:ring-violet-500/10 rounded-xl px-3.5 py-2.5 text-xs transition-all text-slate-100"
        />
        <button
          type="submit"
          className="p-2.5 bg-gradient-to-r from-violet-600 to-blue-500 hover:from-violet-500 hover:to-blue-400 text-white rounded-xl shadow-md transition-all hover:scale-[1.03] cursor-pointer"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
