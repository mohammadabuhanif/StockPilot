import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, Timestamp, onSnapshot, query, orderBy, handleFirestoreError, OperationType, auth } from '../firebase';
import { Expense } from '../types';
import { Plus, Trash2, Edit2, Save, DollarSign, Calendar, Tag, FileText, Filter, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  const [formData, setFormData] = useState({
    title: '',
    category: 'other' as Expense['category'],
    amount: '',
    note: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
      setExpenses(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'expenses');
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const expenseData = {
        title: formData.title,
        category: formData.category,
        amount: parseFloat(formData.amount),
        note: formData.note,
        date: editingExpense ? editingExpense.date : Timestamp.now()
      };

      if (editingExpense) {
        await updateDoc(doc(db, 'expenses', editingExpense.id), expenseData);
      } else {
        await addDoc(collection(db, 'expenses'), expenseData);
      }
      
      setIsModalOpen(false);
      setEditingExpense(null);
      setFormData({ title: '', category: 'other', amount: '', note: '' });
    } catch (err) {
      handleFirestoreError(err, editingExpense ? OperationType.UPDATE : OperationType.CREATE, 'expenses');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'expenses', id));
      setDeletingExpense(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'expenses');
    }
  };

  const filteredExpenses = expenses.filter(e => 
    filterCategory === 'all' || e.category === filterCategory
  );

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingDown className="text-red-500" />
            Expense Tracker
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage your shop costs and overheads</p>
        </div>
        <button
          onClick={() => { setEditingExpense(null); setIsModalOpen(true); }}
          className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-red-200 dark:shadow-none transition-all active:scale-95"
        >
          <Plus size={20} />
          Add Expense
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-2xl text-red-500">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Expenses</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">৳{totalExpenses.toLocaleString()}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <Filter size={16} className="text-slate-400 shrink-0" />
        {['all', 'rent', 'utilities', 'supplies', 'marketing', 'other'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border",
              filterCategory === cat
                ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-800 hover:border-slate-300"
            )}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Expenses List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredExpenses.map((expense) => (
            <motion.div
              key={expense.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={cn(
                  "p-3 rounded-2xl",
                  expense.category === 'rent' ? "bg-blue-50 text-blue-500 dark:bg-blue-900/20" :
                  expense.category === 'utilities' ? "bg-amber-50 text-amber-500 dark:bg-amber-900/20" :
                  expense.category === 'supplies' ? "bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20" :
                  "bg-slate-50 text-slate-500 dark:bg-slate-800"
                )}>
                  <Tag size={20} />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setEditingExpense(expense);
                      setFormData({
                        title: expense.title,
                        category: expense.category,
                        amount: expense.amount.toString(),
                        note: expense.note || ''
                      });
                      setIsModalOpen(true);
                    }}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-blue-500 transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => setDeletingExpense(expense)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <h4 className="font-bold text-slate-900 dark:text-white mb-1">{expense.title}</h4>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mb-4">
                <Calendar size={12} />
                {format(expense.date.toDate(), 'PPP')}
                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                <span className="uppercase font-black tracking-widest">{expense.category}</span>
              </div>

              <div className="flex items-end justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</span>
                  <span className="text-xl font-black text-red-500">৳{expense.amount.toLocaleString()}</span>
                </div>
                {expense.note && (
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 italic">
                    <FileText size={12} />
                    Note added
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredExpenses.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <div className="inline-flex p-6 bg-slate-50 dark:bg-slate-800/50 rounded-full mb-4">
              <TrendingDown size={48} className="text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">No expense records found.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6">
                  {editingExpense ? 'Edit Expense' : 'New Expense'}
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Title</label>
                    <input
                      required
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-red-500 outline-none dark:text-white"
                      placeholder="e.g., Monthly Rent, Electricity Bill"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value as Expense['category'] })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-red-500 outline-none dark:text-white appearance-none"
                      >
                        <option value="rent">Rent</option>
                        <option value="utilities">Utilities</option>
                        <option value="supplies">Supplies</option>
                        <option value="marketing">Marketing</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Amount (৳)</label>
                      <input
                        required
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-red-500 outline-none dark:text-white"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Note (Optional)</label>
                    <textarea
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-red-500 outline-none dark:text-white min-h-[100px]"
                      placeholder="Add any details..."
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-200 dark:shadow-none transition-all"
                    >
                      {editingExpense ? 'Update Record' : 'Save Expense'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingExpense && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingExpense(null)}
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
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Delete Expense?</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8">
                Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-white">"{deletingExpense.title}"</span>? This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setDeletingExpense(null)}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deletingExpense.id)}
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
