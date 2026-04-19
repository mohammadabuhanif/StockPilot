import React, { useState, useRef, useEffect } from 'react';
import { db, collection, getDocs, doc, getDoc, auth, query, where } from '../firebase';
import { HardDrive, Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import gsap from 'gsap';

export default function BackupButton() {
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => setStatus('idle'), 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setStatus('idle');

    // GSAP Animation: Start
    gsap.to(iconRef.current, {
      rotate: 360,
      scale: 0.8,
      duration: 0.5,
      repeat: -1,
      ease: "power1.inOut"
    });

    try {
      const collections = [
        'products',
        'sales',
        'serviceOrders',
        'services',
        'expenses',
        'customers',
        'notes',
        'ideas',
        'repairJobs',
        'users'
      ];

      const backupData: any = {
        exportDate: new Date().toISOString(),
        shopName: 'StockPilot Backup',
        data: {}
      };

      // Fetch all collections
      for (const colName of collections) {
        let snapshot;
        if ((colName === 'notes' || colName === 'ideas') && auth.currentUser) {
          const q = query(collection(db, colName), where('userId', '==', auth.currentUser.uid));
          snapshot = await getDocs(q);
        } else {
          snapshot = await getDocs(collection(db, colName));
        }
        
        backupData.data[colName] = snapshot.docs.map(doc => {
          const data = doc.data();
          // Convert Timestamps to ISO strings for JSON
          const processedData = { ...data, id: doc.id };
          Object.keys(processedData).forEach(key => {
            if (processedData[key] && typeof processedData[key].toDate === 'function') {
              processedData[key] = processedData[key].toDate().toISOString();
            }
          });
          return processedData;
        });
      }

      // Fetch global settings
      const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
      if (settingsSnap.exists()) {
        backupData.settings = settingsSnap.data();
      }

      // Create blob and download
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `stockpilot_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatus('success');
      
      // GSAP Animation: Success
      gsap.killTweensOf(iconRef.current);
      gsap.to(iconRef.current, {
        rotate: 0,
        scale: 1.2,
        duration: 0.3,
        ease: "back.out(2)",
        onComplete: () => {
          gsap.to(iconRef.current, { scale: 1, duration: 0.2 });
        }
      });

    } catch (error) {
      console.error("Export failed:", error);
      setStatus('error');
      gsap.killTweensOf(iconRef.current);
      gsap.to(iconRef.current, {
        keyframes: [
          { x: -10, duration: 0.1 },
          { x: 10, duration: 0.1 },
          { x: -10, duration: 0.1 },
          { x: 10, duration: 0.1 },
          { x: 0, duration: 0.1 }
        ],
        ease: "power2.inOut"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleExport}
        disabled={isExporting}
        className="group relative flex items-center gap-3 px-6 py-4 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-xl hover:shadow-2xl hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden w-full"
      >
        {/* Background Animation Layer */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/5 to-indigo-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
        
        <div 
          ref={iconRef}
          className={`p-3 rounded-2xl shadow-inner transition-colors ${
            status === 'success' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' :
            status === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' :
            'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400'
          }`}
        >
          {isExporting ? <Loader2 className="animate-spin" size={24} /> : 
           status === 'success' ? <CheckCircle2 size={24} /> :
           status === 'error' ? <AlertCircle size={24} /> :
           <HardDrive size={24} />}
        </div>

        <div className="text-left flex-1">
          <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
            {isExporting ? 'Preparing Backup...' : status === 'success' ? 'Backup Complete!' : 'Backup to Device'}
          </h4>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
            {status === 'success' ? 'Check your downloads folder' : 'Save all shop data to your local drive'}
          </p>
        </div>

        <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400 group-hover:text-indigo-500 transition-colors">
          <Download size={18} />
        </div>
      </button>

      {/* Floating Particles on Success */}
      <AnimatePresence>
        {status === 'success' && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
                animate={{ 
                  opacity: 0, 
                  scale: 1, 
                  x: (Math.random() - 0.5) * 100, 
                  y: (Math.random() - 0.5) * 100 
                }}
                exit={{ opacity: 0 }}
                className="absolute top-1/2 left-1/2 w-2 h-2 bg-emerald-400 rounded-full"
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
