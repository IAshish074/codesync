import React, { useState, useEffect, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import { io } from 'socket.io-client';
import { COLLAB_SERVICE_URL, SNIPPET_SERVICE_URL } from '../config';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import ChatPanel from '../components/ChatPanel';
import OutputConsole from '../components/OutputConsole';
import { 
  Users, MessageSquare, Terminal, Save, Lock, Unlock, 
  Copy, Check, ArrowLeft, Settings, Shield, MessageCircle, Play
} from 'lucide-react';

export default function EditorPage({ user, roomId, onBackToDashboard }) {
  const [socket, setSocket] = useState(null);
  const [code, setCode] = useState('// Connecting to session...\n');
  const [language, setLanguage] = useState('javascript');
  const [users, setUsers] = useState([]);
  const [adminId, setAdminId] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState('chat'); // chat, execute, snippets
  
  // Chat state
  const [messages, setMessages] = useState([]);

  // Snippets local list
  const [snippets, setSnippets] = useState([]);
  const [loadingSnippets, setLoadingSnippets] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [snippetTitle, setSnippetTitle] = useState('');
  const [savingSnippet, setSavingSnippet] = useState(false);

  // References for Monaco and OT
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const revisionRef = useRef(0);
  const isRemoteEditRef = useRef(false);
  const cursorDecorationsRef = useRef({}); // userId -> decorationIds

  // Dynamic CSS stylesheet inject for cursors
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.id = 'dynamic-cursors-style';
    document.head.appendChild(styleEl);
    return () => {
      styleEl.remove();
    };
  }, []);

  // Update cursor styles based on active users
  const updateCursorStyles = (userList) => {
    const styleEl = document.getElementById('dynamic-cursors-style');
    if (!styleEl) return;

    let css = '';
    userList.forEach(u => {
      css += `
        .remote-cursor-${u.userId} {
          border-left: 2px solid ${u.color};
          position: relative;
        }
        .remote-cursor-before-${u.userId}::before {
          content: "${u.username}";
          background-color: ${u.color};
          color: #090D16;
          font-weight: 750;
          font-size: 8px;
          position: absolute;
          top: -14px;
          left: -2px;
          padding: 0px 4px;
          border-radius: 3px;
          white-space: nowrap;
          font-family: sans-serif;
          pointer-events: none;
          z-index: 10;
          opacity: 0.8;
          transition: opacity 0.2s;
        }
      `;
    });
    styleEl.innerHTML = css;
  };

  // Connect socket.io
  useEffect(() => {
    const token = localStorage.getItem('token');
    const socketConn = io(COLLAB_SERVICE_URL, {
      transports: ['websocket'],
      auth: { token }
    });

    setSocket(socketConn);

    // Join room
    socketConn.emit('join-room', { roomId, user });

    // Listeners
    socketConn.on('room-joined', ({ code: initialCode, language: initialLang, users: roomUsers, revision, adminId: creatorId }) => {
      isRemoteEditRef.current = true;
      setCode(initialCode);
      setLanguage(initialLang);
      setUsers(roomUsers);
      setAdminId(creatorId);
      revisionRef.current = revision;

      // Track if current user is locked
      const self = roomUsers.find(u => u.userId === user.id);
      if (self) {
        setIsLocked(self.isLocked);
      }

      updateCursorStyles(roomUsers);
      isRemoteEditRef.current = false;
    });

    socketConn.on('user-list-update', ({ users: roomUsers, adminId: creatorId }) => {
      setUsers(roomUsers);
      setAdminId(creatorId);
      
      const self = roomUsers.find(u => u.userId === user.id);
      if (self) {
        setIsLocked(self.isLocked);
      }
      
      updateCursorStyles(roomUsers);
    });

    socketConn.on('chat-update', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socketConn.on('language-update', ({ language: newLang }) => {
      setLanguage(newLang);
    });

    // Handle code update from server
    socketConn.on('code-update', ({ op, revision: newRevision }) => {
      // Update local revision tracker
      revisionRef.current = newRevision;

      // If it is another user's edit, apply it to the Monaco buffer
      if (op.userId !== user.id && editorRef.current && monacoRef.current) {
        const model = editorRef.current.getModel();
        const pos = model.getPositionAt(op.position);

        isRemoteEditRef.current = true;
        
        if (op.type === 'insert') {
          const range = new monacoRef.current.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column);
          editorRef.current.executeEdits('remote-sync', [
            { range, text: op.text, forceMoveMarkers: true }
          ]);
        } else if (op.type === 'delete') {
          const endPos = model.getPositionAt(op.position + op.length);
          const range = new monacoRef.current.Range(pos.lineNumber, pos.column, endPos.lineNumber, endPos.column);
          editorRef.current.executeEdits('remote-sync', [
            { range, text: '', forceMoveMarkers: true }
          ]);
        }

        isRemoteEditRef.current = false;
      }
    });

    // Handle cursor position updates
    socketConn.on('cursor-update', ({ userId, color, cursor }) => {
      if (!editorRef.current || !monacoRef.current) return;

      const model = editorRef.current.getModel();
      const pos = model.getPositionAt(cursor.offset);

      // Remove existing cursor decoration for this user
      let currentDecorations = cursorDecorationsRef.current[userId] || [];

      // Create new decoration at character position
      const range = new monacoRef.current.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column + 1);
      
      const newDecoration = editorRef.current.deltaDecorations(currentDecorations, [
        {
          range,
          options: {
            className: `remote-cursor-${userId}`,
            beforeContentClassName: `remote-cursor-before-${userId}`
          }
        }
      ]);

      cursorDecorationsRef.current[userId] = newDecoration;
    });

    // Fetch Room Snippets
    fetchRoomSnippets();

    return () => {
      socketConn.disconnect();
    };
  }, [roomId]);

  const fetchRoomSnippets = async () => {
    setLoadingSnippets(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${SNIPPET_SERVICE_URL}/api/snippets/room/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSnippets(res.data);
    } catch (err) {
      console.error('Error loading room snippets:', err);
    } finally {
      setLoadingSnippets(false);
    }
  };

  // Editor change handler
  const handleEditorChange = (value, event) => {
    // Check if change was triggered by local keystroke or remote sync
    if (isRemoteEditRef.current || !socket || !editorRef.current) return;

    // Monaco event changes array
    const changes = event.changes;
    if (!changes || changes.length === 0) return;

    changes.forEach(change => {
      const { rangeOffset, rangeLength, text } = change;

      // 1. Send delete operation if text was replaced/removed
      if (rangeLength > 0) {
        const deleteOp = {
          type: 'delete',
          position: rangeOffset,
          length: rangeLength,
          baseRevision: revisionRef.current,
          userId: user.id
        };
        socket.emit('code-change', { roomId, op: deleteOp });
      }

      // 2. Send insert operation if characters were typed
      if (text.length > 0) {
        const insertOp = {
          type: 'insert',
          position: rangeOffset,
          text: text,
          baseRevision: revisionRef.current,
          userId: user.id
        };
        socket.emit('code-change', { roomId, op: insertOp });
      }
    });
  };

  // Cursor change handler
  const handleCursorChange = (event) => {
    if (!socket || !editorRef.current) return;
    
    const position = event.position;
    const model = editorRef.current.getModel();
    const offset = model.getOffsetAt(position);

    socket.emit('cursor-move', {
      roomId,
      userId: user.id,
      username: user.username,
      color: user.color,
      cursor: { offset }
    });
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    if (socket) {
      socket.emit('change-language', { roomId, language: newLang });
    }
  };

  const handleSendMessage = (text) => {
    if (socket) {
      socket.emit('chat-message', {
        roomId,
        message: { text, sender: user.username }
      });
    }
  };

  const toggleUserLockStatus = (targetUserId, currentLock) => {
    if (socket) {
      socket.emit('toggle-lock', {
        roomId,
        targetUserId,
        isLocked: !currentLock,
        requesterUserId: user.id
      });
    }
  };

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveSnippet = async (e) => {
    e.preventDefault();
    if (!snippetTitle.trim()) return;
    setSavingSnippet(true);

    try {
      const token = localStorage.getItem('token');
      const editorCode = editorRef.current ? editorRef.current.getValue() : '';
      await axios.post(
        `${SNIPPET_SERVICE_URL}/api/snippets`,
        {
          title: snippetTitle.trim(),
          code: editorCode,
          language,
          roomId
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSnippetTitle('');
      setShowSaveModal(false);
      fetchRoomSnippets();
    } catch (err) {
      console.error(err);
      alert('Failed to save code snippet.');
    } finally {
      setSavingSnippet(false);
    }
  };

  const loadSnippetIntoEditor = (snippetCode) => {
    if (isLocked) return;
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      const length = model.getValueLength();

      isRemoteEditRef.current = true;
      
      // Decompose replacing entire file
      if (length > 0) {
        socket.emit('code-change', {
          roomId,
          op: { type: 'delete', position: 0, length, baseRevision: revisionRef.current, userId: user.id }
        });
      }
      socket.emit('code-change', {
        roomId,
        op: { type: 'insert', position: 0, text: snippetCode, baseRevision: revisionRef.current, userId: user.id }
      });

      editorRef.current.setValue(snippetCode);
      isRemoteEditRef.current = false;
    }
  };

  const triggerHistorySave = () => {
    if (!socket) return;
    const editorCode = editorRef.current ? editorRef.current.getValue() : '';
    socket.emit('save-session', {
      roomId,
      language,
      finalCode: editorCode,
      userId: user.id
    });
  };

  return (
    <div className="min-h-screen bg-[#070A13] text-slate-100 flex flex-col relative overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between z-10">
        <div className="flex items-center space-x-4">
          <button 
            onClick={onBackToDashboard}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          
          <div className="h-4 w-px bg-slate-800" />
          
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Room ID:</span>
            <span className="font-mono text-sm bg-slate-900 border border-slate-850 px-2 py-0.5 rounded text-violet-400 font-bold tracking-wider">
              {roomId}
            </span>
            <button 
              onClick={handleCopyRoomId}
              className="text-slate-500 hover:text-slate-200 transition-colors p-1"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        {/* Action Panel */}
        <div className="flex items-center space-x-3.5">
          {/* Language selector */}
          <div className="flex items-center space-x-2">
            <Settings size={14} className="text-slate-500" />
            <select
              value={language}
              onChange={handleLanguageChange}
              disabled={isLocked}
              className="bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-violet-500 transition-all font-semibold uppercase tracking-wider"
            >
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
              <option value="c">C</option>
              <option value="go">Go</option>
              <option value="ruby">Ruby</option>
              <option value="rust">Rust</option>
              <option value="csharp">C#</option>
            </select>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Save buttons */}
          <button
            onClick={() => setShowSaveModal(true)}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700/60 text-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <Save size={13} />
            <span>Save Snippet</span>
          </button>

          {adminId === user.id && (
            <button
              onClick={triggerHistorySave}
              className="px-3.5 py-1.5 bg-gradient-to-r from-violet-600 to-blue-500 hover:from-violet-500 hover:to-blue-400 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-md hover:shadow-violet-500/10 transition-all cursor-pointer"
            >
              <Shield size={13} />
              <span>Save Session</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Drawer - Participants & Admin Controls */}
        <aside className="w-64 border-r border-slate-900/80 bg-slate-950/40 p-4.5 flex flex-col justify-between hidden md:flex">
          <div>
            <div className="flex items-center space-x-2 mb-5">
              <Users size={16} className="text-violet-400" />
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Participants ({users.length})</h3>
            </div>
            
            <div className="space-y-3.5">
              {users.map(u => {
                const isRoomAdmin = u.userId === adminId;
                const isSelf = u.userId === user.id;

                return (
                  <div 
                    key={u.socketId}
                    className="flex justify-between items-center p-2 rounded-xl bg-slate-950/30 border border-slate-900/60 shadow-sm"
                  >
                    <div className="flex items-center space-x-2.5 overflow-hidden">
                      <div 
                        className="w-2.5 h-2.5 rounded-full border border-white/20 shadow-md shrink-0" 
                        style={{ backgroundColor: u.color }} 
                      />
                      <span className={`text-xs truncate font-medium ${isSelf ? 'text-slate-100 font-bold' : 'text-slate-400'}`}>
                        {u.username} {isSelf && '(You)'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      {isRoomAdmin && <Shield size={12} className="text-amber-500" title="Admin" />}
                      
                      {/* Locking Toggle */}
                      {adminId === user.id && !isSelf ? (
                        <button
                          onClick={() => toggleUserLockStatus(u.userId, u.isLocked)}
                          className={`p-1 rounded cursor-pointer transition-colors ${
                            u.isLocked ? 'text-red-400 hover:bg-slate-900' : 'text-slate-500 hover:bg-slate-900'
                          }`}
                          title={u.isLocked ? 'Unlock editing' : 'Lock editing'}
                        >
                          {u.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                        </button>
                      ) : (
                        u.isLocked && <Lock size={12} className="text-red-400 shrink-0" title="Locked" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {isLocked && (
            <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-3 text-red-300 text-[11px] flex items-center space-x-1.5 font-medium shadow-sm animate-pulse">
              <Lock size={14} className="shrink-0 text-red-400" />
              <span>Editing locked by room admin.</span>
            </div>
          )}
        </aside>

        {/* Center - Monaco Editor */}
        <main className="flex-1 flex flex-col bg-slate-950/20 relative">
          <div className="flex-1 min-h-[400px]">
            <Editor
              height="100%"
              theme="vs-dark"
              language={language}
              value={code}
              onChange={handleEditorChange}
              onMount={(editor, monaco) => {
                editorRef.current = editor;
                monacoRef.current = monaco;
                
                // Track cursor movements
                editor.onDidChangeCursorPosition(handleCursorChange);
              }}
              options={{
                fontSize: 13,
                fontFamily: 'Fira Code, Menlo, Monaco, monospace',
                minimap: { enabled: false },
                lineHeight: 20,
                readOnly: isLocked,
                padding: { top: 12 },
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                automaticLayout: true
              }}
            />
          </div>
        </main>

        {/* Right collapsible side drawers */}
        <aside className="w-80 border-l border-slate-905 bg-slate-950/25 flex flex-col">
          {/* Tab buttons */}
          <div className="flex bg-slate-950/60 border-b border-slate-900">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex justify-center items-center space-x-1.5 transition-colors cursor-pointer ${
                activeTab === 'chat' ? 'text-violet-400 border-b-2 border-violet-500 bg-slate-950/20' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <MessageCircle size={14} />
              <span>Chat</span>
            </button>
            <button
              onClick={() => setActiveTab('execute')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex justify-center items-center space-x-1.5 transition-colors cursor-pointer ${
                activeTab === 'execute' ? 'text-violet-400 border-b-2 border-violet-500 bg-slate-950/20' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Play size={14} />
              <span>Run</span>
            </button>
            <button
              onClick={() => setActiveTab('snippets')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex justify-center items-center space-x-1.5 transition-colors cursor-pointer ${
                activeTab === 'snippets' ? 'text-violet-400 border-b-2 border-violet-500 bg-slate-950/20' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Save size={14} />
              <span>Snippets</span>
            </button>
          </div>

          <div className="flex-1 p-3">
            {activeTab === 'chat' && (
              <ChatPanel 
                messages={messages} 
                onSendMessage={handleSendMessage} 
                currentUser={user} 
              />
            )}
            
            {activeTab === 'execute' && (
              <OutputConsole 
                code={editorRef.current ? editorRef.current.getValue() : ''} 
                language={language} 
              />
            )}

            {activeTab === 'snippets' && (
              <div className="flex flex-col h-full bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 overflow-y-auto max-h-[calc(100vh-220px)] shadow-2xl">
                <h3 className="text-sm font-bold mb-4 flex items-center space-x-2 text-slate-200 border-b border-slate-850 pb-2">
                  <Save size={16} className="text-violet-400" />
                  <span>Room Snippets ({snippets.length})</span>
                </h3>

                {loadingSnippets ? (
                  <div className="flex-1 flex justify-center items-center text-slate-500 text-xs animate-pulse">
                    Loading snippets...
                  </div>
                ) : snippets.length === 0 ? (
                  <div className="flex-1 flex flex-col justify-center items-center text-center p-4 text-slate-500 italic text-xs">
                    No snippets saved for this room yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {snippets.map(snip => (
                      <div 
                        key={snip._id}
                        className="bg-slate-950/40 hover:bg-slate-950/70 border border-slate-850 rounded-xl p-3 shadow-md transition-all flex flex-col justify-between"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-bold text-slate-200 truncate">{snip.title}</span>
                          <span className="text-[8px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-500 border border-slate-800 uppercase font-semibold font-mono">
                            {snip.language}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-900/50">
                          <span className="text-[9px] text-slate-500 font-medium">By {snip.owner?.username || 'Anonymous'}</span>
                          
                          <button
                            onClick={() => loadSnippetIntoEditor(snip.code)}
                            disabled={isLocked}
                            className="text-[10px] text-violet-400 hover:text-violet-300 font-bold disabled:opacity-30 cursor-pointer"
                          >
                            Load to Editor
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

      </div>

      {/* Save Snippet Modal Overlay */}
      <AnimatePresence>
        {showSaveModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 px-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl space-y-4"
            >
              <h3 className="text-base font-bold text-slate-200">Save Snippet</h3>
              
              <form onSubmit={handleSaveSnippet} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Snippet Title
                  </label>
                  <input
                    type="text"
                    required
                    value={snippetTitle}
                    onChange={(e) => setSnippetTitle(e.target.value)}
                    placeholder="e.g. Binary Search Tree"
                    className="w-full bg-[#0E131F] border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-700 focus:outline-none focus:border-violet-500/70 transition-all"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowSaveModal(false); setSnippetTitle(''); }}
                    className="px-3.5 py-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSnippet}
                    className="px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {savingSnippet ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
