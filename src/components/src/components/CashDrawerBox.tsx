import React, { useState, useEffect, useRef } from 'react';
import { db, collection, addDoc, updateDoc, doc, onSnapshot, query, where, Timestamp, handleFirestoreError, OperationType, auth, storage, ref, uploadBytes, getDownloadURL } from '../firebase';
import { CashRegisterSession, Sale, ServiceOrder, Expense, MFSTransaction, RepairJob } from '../types';
import { format } from 'date-fns';
import { Wallet, Camera, Upload, CheckCircle2, X, AlertTriangle, Lock, Unlock, Calculator } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface CashDrawerBoxProps {
  registerId: 'sales' | 'service' | 'fixer' | 'mfs';
  registerName: string;
}

export function CashDrawerBox({ registerId, registerName }: CashDrawerBoxProps) {
  const [session, setSession] = useState<CashRegisterSession | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  const [openingBalance, setOpeningBalance] = useState<number | ''>('');
  const [closingBalance, setClosingBalance] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [expectedCash, setExpectedCash] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // 1. Listen to today's session
  useEffect(() => {
    const q = query(
      collection(db, 'cashRegisters'), 
      where('date', '==', todayStr),
      where('registerId', '==', registerId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashRegisterSession));
        records.sort((a, b) => b.openedAt.toMillis() - a.openedAt.toMillis());
        setSession(records[0]);
      } else {
        setSession(null);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'cashRegisters'));

    return () => unsubscribe();
  }, [todayStr]);

  // 2. Calculate Expected Cash if session is open
  useEffect(() => {
    if (session?.status !== 'open') return;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    const startTimestamp = Timestamp.fromDate(startOfDay);
    const endTimestamp = Timestamp.fromDate(endOfDay);

    const unsubscribers: (() => void)[] = [];
    
    let currentSales = 0;
    let currentOrders = 0;
    let currentJobs = 0;
    let currentExpenses = 0;
    let currentMfs = 0;

    const updateExpected = () => {
      setExpectedCash(
        session.openingBalance + 
        (registerId === 'sales' ? currentSales : 0) + 
        (registerId === 'service' ? currentOrders - currentExpenses : 0) + 
        (registerId === 'fixer' ? currentJobs : 0) + 
        (registerId === 'mfs' ? currentMfs : 0)
      );
    };

    if (registerId === 'sales') {
      unsubscribers.push(onSnapshot(
        query(collection(db, 'sales'), where('timestamp', '>=', startTimestamp), where('timestamp', '<=', endTimestamp)),
        (snap) => {
          currentSales = snap.docs.reduce((sum, doc) => sum + doc.data().totalPrice, 0);
          updateExpected();
        }
      ));
    }

    if (registerId === 'service') {
      unsubscribers.push(onSnapshot(
        query(collection(db, 'serviceOrders'), where('updatedAt', '>=', startTimestamp), where('updatedAt', '<=', endTimestamp)),
        (snap) => {
          currentOrders = snap.docs.reduce((sum, doc) => {
            const data = doc.data() as ServiceOrder;
            return data.status === 'delivered' ? sum + data.price : sum;
          }, 0);
          updateExpected();
        }
      ));
      unsubscribers.push(onSnapshot(
        query(collection(db, 'expenses'), where('date', '>=', startTimestamp), where('date', '<=', endTimestamp)),
        (snap) => {
          currentExpenses = snap.docs.reduce((sum, doc) => sum + doc.data().amount, 0);
          updateExpected();
        }
      ));
    }

    if (registerId === 'fixer') {
      unsubscribers.push(onSnapshot(
        query(collection(db, 'repairJobs'), where('updatedAt', '>=', startTimestamp), where('updatedAt', '<=', endTimestamp)),
        (snap) => {
          currentJobs = snap.docs.reduce((sum, doc) => {
            const data = doc.data() as RepairJob;
            return data.status === 'delivered' ? sum + data.finalCost : sum;
          }, 0);
          updateExpected();
        }
      ));
    }

    if (registerId === 'mfs') {
      unsubscribers.push(onSnapshot(
        query(collection(db, 'mfsTransactions'), where('createdAt', '>=', startTimestamp), where('createdAt', '<=', endTimestamp)),
        (snap) => {
          currentMfs = snap.docs.reduce((sum, doc) => {
            const data = doc.data() as MFSTransaction;
            // Cash Out: Shop gives physical cash, gets e-money. Drawer decreases.
            if (data.type === 'cash_out') return sum - data.amount;
            // Cash In, Send Money, Recharge: Customer gives physical cash, shop gives e-money. Drawer increases.
            return sum + data.amount; 
          }, 0);
          updateExpected();
        }
      ));
    }

    return () => unsubscribers.forEach(unsub => unsub());
  }, [session, registerId]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (openingBalance === '' || !auth.currentUser) return;

    setIsSubmitting(true);
    try {
      const recordData = {
        registerId,
        date: todayStr,
        status: 'open',
        openedAt: Timestamp.now(),
        openedBy: auth.currentUser.uid,
        openingBalance: Number(openingBalance)
      };

      await addDoc(collection(db, 'cashRegisters'), recordData);
      setIsOpening(false);
      setOpeningBalance('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'cashRegisters');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (closingBalance === '' || !imageFile || !auth.currentUser || !session) return;

    setIsSubmitting(true);
    try {
      // 1. Upload Image
      const imageRef = ref(storage, `cash_registers/${todayStr}_${registerId}_${Date.now()}_${imageFile.name}`);
      await uploadBytes(imageRef, imageFile);
      const closingImageUrl = await getDownloadURL(imageRef);

      const actual = Number(closingBalance);
      const discrepancy = actual - expectedCash;

      // 2. Update Record
      const updateData = {
        status: 'closed',
        closedAt: Timestamp.now(),
        closedBy: auth.currentUser.uid,
        closingBalance: actual,
        expectedBalance: expectedCash,
        discrepancy,
        closingImageUrl,
        notes
      };

      await updateDoc(doc(db, 'cashRegisters', session.id), updateData);
      
      setIsClosing(false);
      setClosingBalance('');
      setNotes('');
      setImageFile(null);
      setImagePreview(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'cashRegisters');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-3 rounded-xl",
            session?.status === 'open' ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : 
            session?.status === 'closed' ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" :
            "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
          )}>
            {session?.status === 'open' ? <Unlock size={24} /> : session?.status === 'closed' ? <Lock size={24} /> : <Wallet size={24} />}
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {registerName}
              {session?.status === 'open' && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-[10px] uppercase tracking-wider font-black">Open</span>}
              {session?.status === 'closed' && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[10px] uppercase tracking-wider font-black">Closed</span>}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {session?.status === 'open' ? 'Currently tracking cash flow' : session?.status === 'closed' ? 'Shift ended for today' : 'Register not opened yet'}
            </p>
          </div>
        </div>

        {session?.status === 'open' && (
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 w-full sm:w-auto">
            <div className="text-left sm:text-right flex-1 sm:flex-none">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Opening</p>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">৳{session.openingBalance.toLocaleString()}</p>
            </div>
            <div className="text-left sm:text-right flex-1 sm:flex-none">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1 sm:justify-end"><Calculator size={10} /> Expected</p>
              <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">৳{expectedCash.toLocaleString()}</p>
            </div>
            <button
              onClick={() => setIsClosing(true)}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-lg"
            >
              Close Register
            </button>
          </div>
        )}

        {session?.status === 'closed' && (
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 w-full sm:w-auto">
            <div className="text-left sm:text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expected</p>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">৳{session.expectedBalance?.toLocaleString()}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actual</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">৳{session.closingBalance?.toLocaleString()}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Discrepancy</p>
              <p className={cn(
                "text-lg font-black",
                (session.discrepancy || 0) < 0 ? "text-red-500" : (session.discrepancy || 0) > 0 ? "text-emerald-500" : "text-slate-400"
              )}>
                {(session.discrepancy || 0) > 0 ? '+' : ''}৳{session.discrepancy?.toLocaleString()}
              </p>
            </div>
            {session.closingImageUrl && (
              <a href={session.closingImageUrl} target="_blank" rel="noopener noreferrer" className="block w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:opacity-80 transition-opacity shrink-0">
                <img src={session.closingImageUrl} alt="Cash Drawer" className="w-full h-full object-cover" />
              </a>
            )}
          </div>
        )}

        {!session && (
          <button
            onClick={() => setIsOpening(true)}
            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
          >
            Open Register
          </button>
        )}
      </div>

      {/* Open Register Modal */}
      <AnimatePresence>
        {isOpening && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2"><Unlock size={20} className="text-emerald-500"/> Open {registerName}</h3>
                <button onClick={() => setIsOpening(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleOpenRegister} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Opening Float / Cash in Drawer (৳)</label>
                  <input
                    required
                    type="number"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value ? Number(e.target.value) : '')}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-2xl font-black text-center"
                    placeholder="0"
                  />
                  <p className="text-xs text-slate-500 text-center mt-2">Enter the amount of cash currently in the till.</p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || openingBalance === ''}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-xl shadow-emerald-200 dark:shadow-none transition-all active:scale-95 mt-4"
                >
                  {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : "Start Shift"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Close Register Modal */}
      <AnimatePresence>
        {isClosing && session && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-10">
                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2"><Lock size={20} className="text-indigo-500"/> Close {registerName}</h3>
                <button onClick={() => setIsClosing(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleCloseRegister} className="p-6 space-y-6">
                
                <div className="bg-indigo-50 dark:bg-indigo-500/10 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 text-center">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">System Expected Cash</p>
                  <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">৳{expectedCash.toLocaleString()}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actual Counted Cash (৳)</label>
                  <input
                    required
                    type="number"
                    value={closingBalance}
                    onChange={(e) => setClosingBalance(e.target.value ? Number(e.target.value) : '')}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-2xl font-black text-center"
                    placeholder="0"
                  />
                  {closingBalance !== '' && (
                    <div className={cn(
                      "text-sm font-bold text-center p-2 rounded-lg",
                      (Number(closingBalance) - expectedCash) < 0 ? "text-red-600 bg-red-50 dark:bg-red-500/10" : 
                      (Number(closingBalance) - expectedCash) > 0 ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" : 
                      "text-slate-600 bg-slate-100 dark:bg-slate-800"
                    )}>
                      Discrepancy: {((Number(closingBalance) - expectedCash) > 0 ? '+' : '')}৳{(Number(closingBalance) - expectedCash).toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Photo Proof</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "w-full h-32 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative",
                      imagePreview 
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" 
                        : "border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                  >
                    {imagePreview ? (
                      <>
                        <img src={imagePreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-50" />
                        <div className="relative z-10 flex flex-col items-center text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={24} className="mb-2" />
                          <span className="text-xs font-bold">Photo Selected</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <Camera size={24} className="text-slate-400 mb-2" />
                        <span className="text-xs font-bold text-slate-500">Tap to take photo of the cash</span>
                      </>
                    )}
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageChange} 
                      accept="image/*" 
                      capture="environment"
                      className="hidden" 
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Closing Notes (Optional)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    placeholder="Explain any discrepancies..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || closingBalance === '' || !imageFile}
                  className="w-full py-4 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 disabled:bg-slate-300 disabled:cursor-not-allowed text-white dark:text-slate-900 font-black rounded-2xl shadow-xl transition-all active:scale-95 mt-4 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white dark:border-slate-900/30 dark:border-t-slate-900 rounded-full animate-spin" />
                  ) : (
                    <>
                      <Upload size={18} />
                      Submit & Close Register
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

