import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, onSnapshot, query, orderBy, handleFirestoreError, OperationType, Timestamp } from '../firebase';
import { MFSTransaction } from '../types';
import { Smartphone, Send, Download, Plus, Search, Filter, ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { cn, formatAppDateTime } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { CashDrawerBox } from './CashDrawerBox';

export function MobileFinancialServices() {
  const [transactions, setTransactions] = useState<MFSTransaction[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProvider, setFilterProvider] = useState<string>('all');

  const [newTx, setNewTx] = useState({
    provider: 'bkash' as const,
    type: 'cash_in' as const,
    amount: '',
    commission: '',
    customerPhone: '',
    notes: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'mfsTransactions'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MFSTransaction));
      setTransactions(data);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'mfsTransactions'));

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const txData = {
        ...newTx,
        amount: Number(newTx.amount),
        commission: Number(newTx.commission),
        createdAt: Timestamp.now()
      };
      await addDoc(collection(db, 'mfsTransactions'), txData);
      setIsAdding(false);
      setNewTx({ provider: 'bkash', type: 'cash_in', amount: '', commission: '', customerPhone: '', notes: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'mfsTransactions');
    }
  };

  const filteredTx = transactions.filter(tx => {
    const matchesProvider = filterProvider === 'all' || tx.provider === filterProvider;
    const matchesSearch = tx.customerPhone.includes(searchTerm) || (tx.notes && tx.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesProvider && matchesSearch;
  });

  const todayTx = transactions.filter(tx => isSameDay(tx.createdAt.toDate(), new Date()));
  const todayCommission = todayTx.reduce((sum, tx) => sum + tx.commission, 0);
  const todayVolume = todayTx.reduce((sum, tx) => sum + tx.amount, 0);

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'bkash': return 'bg-pink-50 text-pink-600 border-pink-100 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-500/20';
      case 'nagad': return 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20';
      case 'rocket': return 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20';
      case 'recharge': return 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
      default: return 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'cash_in': return <ArrowUpRight size={16} className="text-emerald-500" />;
      case 'cash_out': return <ArrowDownRight size={16} className="text-red-500" />;
      case 'send_money': return <Send size={16} className="text-blue-500" />;
      case 'recharge': return <Zap size={16} className="text-amber-500" />;
      default: return <Smartphone size={16} />;
    }
  };

  return (
    <div className="space-y-6">
      <CashDrawerBox registerId="mfs" registerName="MFS & Recharge Register" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Zap size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Today's Commission</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">৳{todayCommission.toLocaleString()}</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl">
            <ArrowUpRight size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Today's Volume</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">৳{todayVolume.toLocaleString()}</h3>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search phone number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
          {['all', 'bkash', 'nagad', 'rocket', 'recharge'].map(provider => (
            <button
              key={provider}
              onClick={() => setFilterProvider(provider)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap capitalize",
                filterProvider === provider 
                  ? "bg-indigo-600 border-indigo-600 text-white" 
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-200"
              )}
            >
              {provider}
            </button>
          ))}
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="shrink-0 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95"
        >
          <Plus size={20} />
          New Transaction
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Time</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Provider</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Amount</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTx.map(tx => (
                <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                    {formatAppDateTime(tx.createdAt.toDate())}
                  </td>
                  <td className="p-4">
                    <span className={cn("px-2.5 py-1 rounded-lg text-xs font-bold border capitalize", getProviderColor(tx.provider))}>
                      {tx.provider}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-300 capitalize">
                      {getTypeIcon(tx.type)}
                      {tx.type.replace('_', ' ')}
                    </div>
                  </td>
                  <td className="p-4 text-sm font-mono text-slate-700 dark:text-slate-300">
                    {tx.customerPhone}
                  </td>
                  <td className="p-4 text-right font-black text-slate-900 dark:text-white">
                    ৳{tx.amount.toLocaleString()}
                  </td>
                  <td className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    +৳{tx.commission.toLocaleString()}
                  </td>
                </tr>
              ))}
              {filteredTx.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">New Transaction</h3>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                  <Plus size={20} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Provider</label>
                    <select
                      value={newTx.provider}
                      onChange={(e) => setNewTx({ ...newTx, provider: e.target.value as any })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white capitalize"
                    >
                      <option value="bkash">bKash</option>
                      <option value="nagad">Nagad</option>
                      <option value="rocket">Rocket</option>
                      <option value="recharge">Mobile Recharge</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</label>
                    <select
                      value={newTx.type}
                      onChange={(e) => setNewTx({ ...newTx, type: e.target.value as any })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white capitalize"
                    >
                      <option value="cash_in">Cash In</option>
                      <option value="cash_out">Cash Out</option>
                      <option value="send_money">Send Money</option>
                      <option value="recharge">Recharge</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer Phone</label>
                  <input
                    required
                    type="tel"
                    value={newTx.customerPhone}
                    onChange={(e) => setNewTx({ ...newTx, customerPhone: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white font-mono"
                    placeholder="017..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount (৳)</label>
                    <input
                      required
                      type="number"
                      value={newTx.amount}
                      onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Commission (৳)</label>
                    <input
                      required
                      type="number"
                      value={newTx.commission}
                      onChange={(e) => setNewTx({ ...newTx, commission: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      placeholder="0"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none transition-all active:scale-95 mt-4"
                >
                  Save Transaction
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
