import React, { useState, useEffect, useRef } from 'react';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, Timestamp, onSnapshot, query, orderBy, where, handleFirestoreError, OperationType, auth } from '../firebase';
import { Note, Idea, Product, Sale, AppUser } from '../types';
import { GoogleGenAI } from "@google/genai";
import { Send, Plus, Trash2, Edit2, Save, Sparkles, Heart, Flower2, Type, Palette, Maximize2, Minimize2, MessageSquare, BrainCircuit, ShieldCheck, Lock, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { cn, formatAppTime, formatAppDateTime } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import CatAssistant from './CatAssistant';

interface PersonalCenterProps {
  products: Product[];
  sales: Sale[];
  appUser: AppUser | null;
}

export default function PersonalCenter({ products, sales, appUser }: PersonalCenterProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isAiTalking, setIsAiTalking] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const noteContentRef = useRef<HTMLDivElement>(null);

  // Fetch Notes
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'notes'), 
      where('userId', '==', auth.currentUser.uid),
      orderBy('updatedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
      setNotes(notesData);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'notes');
    });
    return () => unsubscribe();
  }, []);

  // Fetch AI Ideas
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'ideas'), 
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ideasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Idea));
      setIdeas(ideasData);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'ideas');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleCreateNote = async () => {
    if (!auth.currentUser) return;
    try {
      const newNote = {
        userId: auth.currentUser.uid,
        title: 'New Thought',
        content: 'Write your ideas here...',
        color: '#FFB7C5',
        fontSize: '16px',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      const docRef = await addDoc(collection(db, 'notes'), newNote);
      setActiveNote({ id: docRef.id, ...newNote });
      setIsEditing(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'notes');
    }
  };

  const handleSaveNote = async () => {
    if (!activeNote) return;
    try {
      const content = noteContentRef.current?.innerHTML || '';
      await updateDoc(doc(db, 'notes', activeNote.id), {
        ...activeNote,
        content,
        updatedAt: Timestamp.now(),
      });
      setIsEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'notes');
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notes', id));
      if (activeNote?.id === id) {
        setActiveNote(null);
        setIsEditing(false);
      }
      setNoteToDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'notes');
    }
  };

  const applyStyle = (command: string, value?: string) => {
    document.execCommand(command, false, value);
  };

  const handleChat = async () => {
    // ... existing handleChat code ...
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(false);

    if (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
      setPinError('PIN must be 4-6 digits.');
      return;
    }

    if (newPin !== confirmPin) {
      setPinError('PINs do not match.');
      return;
    }

    if (!auth.currentUser) return;

    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        pin: newPin
      });
      setPinSuccess(true);
      setNewPin('');
      setConfirmPin('');
      setTimeout(() => {
        setPinSuccess(false);
        setShowSecurity(false);
      }, 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
      setPinError('Failed to update PIN.');
    }
  };

  return (
    <div className="relative h-[calc(100dvh-12rem)] lg:h-[calc(100vh-10rem)] bg-gradient-to-br from-pink-50 to-white dark:from-slate-950 dark:to-pink-950/10 rounded-[2.5rem] border border-pink-100 dark:border-pink-900/30 shadow-2xl overflow-hidden">
      {/* Sakura Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-pink-200/40"
            initial={{ y: -20, x: Math.random() * 100 + '%', rotate: 0 }}
            animate={{ 
              y: '110%', 
              x: (Math.random() * 100 - 50) + '%',
              rotate: 360 
            }}
            transition={{ 
              duration: Math.random() * 15 + 15, 
              repeat: Infinity, 
              ease: "linear",
              delay: Math.random() * 10
            }}
          >
            <Flower2 size={Math.random() * 24 + 12} />
          </motion.div>
        ))}
      </div>

      {/* Main Layout: Sakura AI Chat as Full Page */}
      <div className="relative h-full flex flex-col z-10">
        {/* Header */}
        <div className="p-6 flex justify-between items-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-b border-pink-100/50 dark:border-pink-900/20">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 bg-pink-100 dark:bg-pink-900/30 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-pink-200 dark:border-pink-800 shadow-inner">
                <CatAssistant isThinking={isAiThinking} isTalking={isAiTalking} className="w-12 h-12" />
              </div>
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" 
              />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                Sakura AI
                <Sparkles size={16} className="text-pink-500 animate-pulse" />
              </h3>
              <p className="text-[10px] text-pink-600 dark:text-pink-400 font-black uppercase tracking-[0.2em]">Your Shop's Soul</p>
            </div>
          </div>

          {/* Compact Cute Notes Button */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowSecurity(true)}
              className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-indigo-100 dark:hover:shadow-none transition-all active:scale-95 text-slate-600 dark:text-slate-400"
              title="Security Settings"
            >
              <ShieldCheck size={20} />
            </button>
            <button
              onClick={() => setShowNotes(true)}
              className="group relative p-3 bg-white dark:bg-slate-800 rounded-2xl border border-pink-200 dark:border-pink-800 shadow-lg hover:shadow-pink-200 dark:hover:shadow-none transition-all active:scale-95 overflow-hidden"
            >
              <div className="absolute inset-0 bg-pink-500 opacity-0 group-hover:opacity-10 transition-opacity" />
              <div className="flex items-center gap-2">
                <Heart size={20} className="text-pink-500 fill-pink-500 group-hover:scale-110 transition-transform" />
                <span className="hidden sm:inline text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">My Thoughts</span>
              </div>
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
          {chatMessages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
              <div className="p-8 bg-white/60 dark:bg-slate-800/60 rounded-[3rem] border border-pink-100 dark:border-pink-900/30 shadow-xl backdrop-blur-sm">
                <p className="text-lg font-medium text-slate-600 dark:text-slate-300 italic leading-relaxed">
                  "Meow! I'm Sakura, your dedicated shop assistant. I'm here to listen to your frustrations, store your brilliant ideas, and help our shop grow. What's on your mind today?"
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                {[
                  { text: "I'm feeling stressed...", icon: <Heart size={14} />, color: "pink" },
                  { text: "Give me a sales idea!", icon: <BrainCircuit size={14} />, color: "indigo" },
                  { text: "What's our status?", icon: <Sparkles size={14} />, color: "amber" }
                ].map((btn, i) => (
                  <button 
                    key={i}
                    onClick={() => setChatInput(btn.text)}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all hover:-translate-y-1 active:translate-y-0 shadow-sm",
                      btn.color === 'pink' ? "bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400 hover:bg-pink-100" :
                      btn.color === 'indigo' ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 hover:bg-indigo-100" :
                      "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 hover:bg-amber-100"
                    )}
                  >
                    {btn.icon}
                    {btn.text}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {chatMessages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cn(
                "flex flex-col max-w-[85%] sm:max-w-[70%]",
                msg.role === 'user' ? "ml-auto items-end" : "items-start"
              )}
            >
              <div className={cn(
                "p-4 rounded-[2rem] text-sm shadow-md backdrop-blur-sm",
                msg.role === 'user' 
                  ? "bg-indigo-600 text-white rounded-tr-none" 
                  : "bg-white/90 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 rounded-tl-none border border-pink-100 dark:border-pink-800/50"
              )}>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <Markdown>{msg.text}</Markdown>
                </div>
              </div>
              <span className="text-[10px] text-slate-400 mt-2 uppercase font-black tracking-widest px-2">
                {msg.role === 'user' ? 'Master' : 'Sakura'}
              </span>
            </motion.div>
          ))}
          {isAiThinking && (
            <div className="flex gap-2 items-center p-4 bg-white/40 dark:bg-slate-800/40 rounded-2xl w-fit">
              <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 bg-pink-400 rounded-full" />
              <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 bg-pink-400 rounded-full" />
              <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 bg-pink-400 rounded-full" />
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div className="p-6 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-t border-pink-100/50 dark:border-pink-900/20">
          <div className="max-w-4xl mx-auto relative group">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleChat()}
              placeholder="Whisper to Sakura..."
              className="w-full bg-white/80 dark:bg-slate-800/80 border-2 border-pink-100 dark:border-pink-900/30 rounded-[2rem] py-4 pl-6 pr-16 text-sm focus:ring-4 focus:ring-pink-500/20 focus:border-pink-500 outline-none dark:text-white shadow-lg transition-all"
            />
            <button
              onClick={handleChat}
              disabled={!chatInput.trim() || isAiThinking}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 bg-pink-500 text-white rounded-full shadow-lg shadow-pink-200 dark:shadow-none hover:bg-pink-600 transition-all disabled:opacity-50 flex items-center justify-center active:scale-90"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Notes Drawer Overlay */}
      <AnimatePresence>
        {showNotes && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNotes(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute inset-y-0 right-0 w-full sm:w-[32rem] bg-white dark:bg-slate-900 shadow-2xl z-[70] flex flex-col border-l border-pink-100 dark:border-pink-900/30"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-pink-50 dark:border-pink-900/20 flex justify-between items-center bg-gradient-to-r from-pink-50 to-white dark:from-pink-900/10 dark:to-slate-900">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-xl text-pink-600 dark:text-pink-400">
                    <Heart size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">My Thoughts</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">Safe space for your ideas</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateNote}
                    className="p-2 bg-pink-500 hover:bg-pink-600 text-white rounded-xl shadow-lg shadow-pink-200 dark:shadow-none transition-all active:scale-95"
                  >
                    <Plus size={20} />
                  </button>
                  <button 
                    onClick={() => setShowNotes(false)} 
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                  >
                    <Plus size={20} className="rotate-45" />
                  </button>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 flex overflow-hidden">
                {/* Notes List */}
                <div className={cn(
                  "w-full sm:w-48 border-r border-pink-50 dark:border-pink-900/20 overflow-y-auto p-4 space-y-3 bg-slate-50/30 dark:bg-slate-800/10",
                  activeNote && "hidden sm:block"
                )}>
                  {notes.map(note => (
                    <button
                      key={note.id}
                      onClick={() => { setActiveNote(note); setIsEditing(false); }}
                      className={cn(
                        "w-full text-left p-4 rounded-2xl transition-all border group relative overflow-hidden",
                        activeNote?.id === note.id
                          ? "bg-white dark:bg-slate-800 border-pink-200 dark:border-pink-800 shadow-md"
                          : "bg-white/50 dark:bg-slate-800/30 border-transparent hover:border-pink-100 dark:hover:border-pink-900/30"
                      )}
                    >
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">{note.title}</h4>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-1 font-bold">
                        {format(note.updatedAt.toDate(), 'MMM dd')}
                      </p>
                      {activeNote?.id === note.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-pink-500" />}
                    </button>
                  ))}
                  {notes.length === 0 && (
                    <div className="text-center py-12 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                      No thoughts yet...
                    </div>
                  )}
                </div>

                {/* Note Editor */}
                <div className={cn(
                  "flex-1 flex flex-col p-6 overflow-y-auto bg-white dark:bg-slate-900",
                  !activeNote && "hidden sm:flex"
                )}>
                  {activeNote ? (
                    <div className="h-full flex flex-col">
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => { setActiveNote(null); setIsEditing(false); }}
                            className="sm:hidden p-2 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-xl text-pink-600"
                          >
                            <Plus size={20} className="rotate-45" />
                          </button>
                          {isEditing ? (
                            <input
                              type="text"
                              value={activeNote.title}
                              onChange={(e) => setActiveNote({ ...activeNote, title: e.target.value })}
                              className="text-xl font-black bg-transparent border-b-2 border-pink-200 dark:border-pink-800 focus:border-pink-500 outline-none text-slate-900 dark:text-white w-full"
                            />
                          ) : (
                            <h2 className="text-xl font-black text-slate-900 dark:text-white truncate">{activeNote.title}</h2>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {isEditing ? (
                            <button onClick={handleSaveNote} className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-200 dark:shadow-none">
                              <Save size={18} />
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button onClick={() => setIsEditing(true)} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors">
                                <Edit2 size={18} />
                              </button>
                              <button onClick={() => setNoteToDelete(activeNote)} className="p-2 bg-slate-100 dark:bg-slate-800 text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                <Trash2 size={18} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {isEditing && (
                        <div className="flex flex-wrap gap-2 mb-6 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <button onClick={() => applyStyle('bold')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-400"><Type size={16} className="font-bold" /></button>
                          <button onClick={() => applyStyle('italic')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-400 italic">I</button>
                          <button onClick={() => applyStyle('underline')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-400 underline">U</button>
                          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 self-center mx-1" />
                          <button onClick={() => applyStyle('foreColor', '#FF69B4')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl text-pink-500"><Palette size={16} /></button>
                          <button onClick={() => applyStyle('fontSize', '5')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-400"><Maximize2 size={16} /></button>
                          <button onClick={() => applyStyle('fontSize', '3')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-400"><Minimize2 size={16} /></button>
                        </div>
                      )}

                      <div
                        ref={noteContentRef}
                        contentEditable={isEditing}
                        dangerouslySetInnerHTML={{ __html: activeNote.content }}
                        className={cn(
                          "flex-1 outline-none prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300",
                          isEditing && "bg-white/50 dark:bg-slate-800/30 p-6 rounded-[2rem] border-2 border-dashed border-pink-200 dark:border-pink-800"
                        )}
                        style={{ fontSize: activeNote.fontSize }}
                      />
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-4">
                      <div className="p-8 bg-pink-50 dark:bg-pink-900/10 rounded-full">
                        <Sparkles size={64} className="text-pink-300 dark:text-pink-700" />
                      </div>
                      <p className="font-black text-xs uppercase tracking-[0.2em]">Select a thought to read</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Ideas Log in Drawer */}
              <div className="p-6 bg-slate-50 dark:bg-slate-800/30 border-t border-pink-50 dark:border-pink-900/20">
                <div className="flex items-center gap-2 mb-4">
                  <BrainCircuit size={16} className="text-indigo-500" />
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Smart Ideas Log</span>
                </div>
                <div className="grid grid-cols-1 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {ideas.map(idea => (
                    <div key={idea.id} className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 shadow-sm relative overflow-hidden group">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-50" />
                      {idea.content}
                    </div>
                  ))}
                  {ideas.length === 0 && <p className="text-[10px] text-slate-400 italic text-center py-4">No ideas stored yet...</p>}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Security Settings Drawer */}
      <AnimatePresence>
        {showSecurity && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSecurity(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute inset-y-0 right-0 w-full sm:w-[28rem] bg-white dark:bg-slate-900 shadow-2xl z-[70] flex flex-col border-l border-slate-100 dark:border-slate-800"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <Lock size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Security</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">Manage your access PIN</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSecurity(false)} 
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                >
                  <Plus size={20} className="rotate-45" />
                </button>
              </div>

              <div className="p-8 space-y-8">
                <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl p-6 border border-indigo-100 dark:border-indigo-500/20">
                  <div className="flex items-center gap-3 mb-4">
                    <KeyRound className="text-indigo-600" size={24} />
                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Change Security PIN</h4>
                  </div>
                  
                  <form onSubmit={handleChangePin} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New PIN (4-6 digits)</label>
                      <input
                        type="password"
                        maxLength={6}
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border-none rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        placeholder="••••••"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm New PIN</label>
                      <input
                        type="password"
                        maxLength={6}
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border-none rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        placeholder="••••••"
                      />
                    </div>

                    {pinError && (
                      <p className="text-xs font-bold text-red-500 flex items-center gap-1.5">
                        <AlertCircle size={14} />
                        {pinError}
                      </p>
                    )}

                    {pinSuccess && (
                      <p className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
                        <CheckCircle2 size={14} />
                        PIN updated successfully!
                      </p>
                    )}

                    <button
                      type="submit"
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95"
                    >
                      Update PIN
                    </button>
                  </form>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2">About Security PIN</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Your PIN is used to lock your workspace after 1 minute of inactivity. This keeps your data safe when you step away from your device.
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Note Delete Confirmation */}
      <AnimatePresence>
        {noteToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNoteToDelete(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} className="text-red-600" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Delete Thought?</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8">
                Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-white">"{noteToDelete.title}"</span>? This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setNoteToDelete(null)}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteNote(noteToDelete.id)}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
