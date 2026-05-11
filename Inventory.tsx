import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, addDoc, updateDoc, doc, query, where, orderBy, serverTimestamp, handleFirestoreError, OperationType, auth } from '../firebase';
import { RepairJob, UserRole } from '../types';
import { Wrench, Plus, Search, Clock, CheckCircle2, AlertCircle, Phone, User, Smartphone, DollarSign, Filter, ChevronRight, MoreVertical, Trash2, Edit2, TrendingUp, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isSameDay, subDays } from 'date-fns';

import { CashDrawerBox } from './CashDrawerBox';

interface FixerSpaceProps {
  userRole: UserRole;
}

export default function FixerSpace({ userRole }: FixerSpaceProps) {
  const [jobs, setJobs] = useState<RepairJob[]>([]);
  const [isAddingJob, setIsAddingJob] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const [newJob, setNewJob] = useState({
    customerName: '',
    customerPhone: '',
    deviceModel: '',
    issueDescription: '',
    estimatedCost: 0,
    partsCost: 0,
    laborCost: 0,
    notes: ''
  });

  useEffect(() => {
    if (!auth.currentUser) return;

    let q;
    if (userRole === 'admin') {
      q = query(collection(db, 'repairJobs'), orderBy('createdAt', 'desc'));
    } else {
      q = query(
        collection(db, 'repairJobs'),
        where('fixerId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const jobsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RepairJob[];
      setJobs(jobsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'repairJobs');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userRole]);

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      const earnings = newJob.laborCost; // Simple model: earnings is the labor cost
      await addDoc(collection(db, 'repairJobs'), {
        ...newJob,
        fixerId: auth.currentUser.uid,
        status: 'pending',
        finalCost: newJob.estimatedCost,
        earnings,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setIsAddingJob(false);
      setNewJob({
        customerName: '',
        customerPhone: '',
        deviceModel: '',
        issueDescription: '',
        estimatedCost: 0,
        partsCost: 0,
        laborCost: 0,
        notes: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'repairJobs');
    }
  };

  const updateJobStatus = async (jobId: string, newStatus: RepairJob['status']) => {
    try {
      await updateDoc(doc(db, 'repairJobs', jobId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `repairJobs/${jobId}`);
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = 
      job.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.customerPhone.includes(searchQuery) ||
      job.deviceModel.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const totalEarnings = jobs
    .filter(job => job.status === 'delivered')
    .reduce((sum, job) => sum + job.earnings, 0);

  const pendingJobs = jobs.filter(job => ['pending', 'diagnosing', 'repairing', 'waiting_parts'].includes(job.status)).length;

  const incomeStats = {
    daily: jobs.filter(j => j.createdAt && isSameDay(j.createdAt.toDate(), new Date())).reduce((sum, j) => sum + (j.finalCost || 0), 0),
    weekly: jobs.filter(j => j.createdAt && j.createdAt.toDate() > subDays(new Date(), 7)).reduce((sum, j) => sum + (j.finalCost || 0), 0),
    monthly: jobs.filter(j => j.createdAt && j.createdAt.toDate() > subDays(new Date(), 30)).reduce((sum, j) => sum + (j.finalCost || 0), 0),
  };

  const getStatusColor = (status: RepairJob['status']) => {
    switch (status) {
      case 'pending': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
      case 'diagnosing': return 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400';
      case 'waiting_parts': return 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400';
      case 'repairing': return 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400';
      case 'ready': return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400';
      case 'delivered': return 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400';
      case 'cancelled': return 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <Wrench className="text-indigo-600" size={32} />
            Fixer Space
          </h2>
          <p className="text-slate-500 dark:text-slate-400">Manage your repair jobs and track earnings.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Earnings</p>
              <p className="text-xl font-black text-slate-900 dark:text-white">৳{totalEarnings.toLocaleString()}</p>
            </div>
          </div>

          <div className="hidden lg:flex bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 items-center gap-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl">
              <TrendingUp size={20} />
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Today</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">৳{incomeStats.daily.toLocaleString()}</p>
              </div>
              <div className="w-px h-8 bg-slate-100 dark:bg-slate-800" />
              <div>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Weekly</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">৳{incomeStats.weekly.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
            <div className="p-2 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Jobs</p>
              <p className="text-xl font-black text-slate-900 dark:text-white">{pendingJobs}</p>
            </div>
          </div>
        </div>
      </div>

      <CashDrawerBox registerId="fixer" registerName="Fixer Space Register" />

      {/* Actions & Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search by customer, phone, or device..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
          {['all', 'pending', 'diagnosing', 'repairing', 'ready', 'delivered'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                statusFilter === status
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-indigo-300'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        <button
          onClick={() => setIsAddingJob(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
        >
          <Plus size={20} />
          New Repair
        </button>
      </div>

      {/* Jobs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredJobs.map((job) => (
            <motion.div
              key={job.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(job.status)}`}>
                  {job.status.replace('_', ' ')}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  {job.createdAt ? format(job.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 dark:text-white leading-tight">{job.deviceModel}</h4>
                    <p className="text-xs text-slate-500 line-clamp-1">{job.issueDescription}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400">
                    <User size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{job.customerName}</p>
                    <p className="text-[10px] text-slate-500">{job.customerPhone}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Cost</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">৳{job.finalCost}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Earnings</p>
                    <p className="text-lg font-black text-emerald-600">৳{job.earnings}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  {job.status !== 'delivered' && job.status !== 'cancelled' && (
                    <select
                      value={job.status}
                      onChange={(e) => updateJobStatus(job.id, e.target.value as RepairJob['status'])}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none dark:text-white"
                    >
                      <option value="pending">Pending</option>
                      <option value="diagnosing">Diagnosing</option>
                      <option value="waiting_parts">Waiting Parts</option>
                      <option value="repairing">Repairing</option>
                      <option value="ready">Ready to Deliver</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  )}
                  {job.status === 'delivered' && (
                    <div className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-xl text-xs font-bold">
                      <CheckCircle2 size={14} />
                      Completed
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add Job Modal */}
      <AnimatePresence>
        {isAddingJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">New Repair Job</h3>
                    <p className="text-slate-500 text-sm">Fill in the details to start a new repair.</p>
                  </div>
                  <button 
                    onClick={() => setIsAddingJob(false)}
                    className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors text-slate-400"
                  >
                    <Plus className="rotate-45" size={24} />
                  </button>
                </div>

                <form onSubmit={handleAddJob} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Customer Name</label>
                      <input
                        required
                        type="text"
                        value={newJob.customerName}
                        onChange={(e) => setNewJob({ ...newJob, customerName: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                        placeholder="e.g. John Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Phone Number</label>
                      <input
                        required
                        type="tel"
                        value={newJob.customerPhone}
                        onChange={(e) => setNewJob({ ...newJob, customerPhone: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                        placeholder="e.g. 017XXXXXXXX"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Device Model</label>
                      <input
                        required
                        type="text"
                        value={newJob.deviceModel}
                        onChange={(e) => setNewJob({ ...newJob, deviceModel: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                        placeholder="e.g. iPhone 13 Pro"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Issue Description</label>
                      <input
                        required
                        type="text"
                        value={newJob.issueDescription}
                        onChange={(e) => setNewJob({ ...newJob, issueDescription: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                        placeholder="e.g. Broken screen"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Estimated Bill (৳)</label>
                      <input
                        required
                        type="number"
                        value={newJob.estimatedCost}
                        onChange={(e) => setNewJob({ ...newJob, estimatedCost: Number(e.target.value) })}
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Parts Cost (৳)</label>
                      <input
                        required
                        type="number"
                        value={newJob.partsCost}
                        onChange={(e) => setNewJob({ ...newJob, partsCost: Number(e.target.value) })}
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Labor/Earnings (৳)</label>
                      <input
                        required
                        type="number"
                        value={newJob.laborCost}
                        onChange={(e) => setNewJob({ ...newJob, laborCost: Number(e.target.value) })}
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 dark:shadow-none"
                    >
                      Create Repair Job
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
