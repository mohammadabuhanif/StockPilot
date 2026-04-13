import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Delete, CheckCircle2, AlertCircle, Lock, User, KeyRound, LogOut } from 'lucide-react';
import { db, doc, updateDoc, handleFirestoreError, OperationType, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { AppUser } from '../types';

interface PinLockProps {
  user: AppUser;
  onUnlock: () => void;
  onPinSet: (newPin: string) => void;
}

export default function PinLock({ user, onUnlock, onPinSet }: PinLockProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(!user.pin);
  const [step, setStep] = useState<'enter' | 'confirm'>(isSettingUp ? 'enter' : 'enter');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleNumberClick = (num: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
      setError(null);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  useEffect(() => {
    if (!isSettingUp && pin.length === (user.pin?.length || 4)) {
      verifyPin();
    } else if (isSettingUp && pin.length === 6 && step === 'enter') {
      // Auto-advance to confirm step for setup
      setConfirmPin(pin);
      setPin('');
      setStep('confirm');
    } else if (isSettingUp && pin.length === 6 && step === 'confirm') {
      handlePinSetup();
    }
  }, [pin]);

  const verifyPin = async () => {
    setIsVerifying(true);
    if (pin === user.pin) {
      onUnlock();
    } else {
      setError('Incorrect PIN. Please try again.');
      setPin('');
      // Shake animation effect could be added here
    }
    setIsVerifying(false);
  };

  const handlePinSetup = async () => {
    if (pin === confirmPin) {
      setIsVerifying(true);
      try {
        await updateDoc(doc(db, 'users', user.id), {
          pin: pin
        });
        onPinSet(pin);
        onUnlock();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.id}`);
        setError('Failed to save PIN. Please try again.');
      } finally {
        setIsVerifying(false);
      }
    } else {
      setError('PINs do not match. Start over.');
      setPin('');
      setConfirmPin('');
      setStep('enter');
    }
  };

  const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800 relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col items-center">
          <motion.div 
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            className="p-4 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-3xl mb-6"
          >
            {isSettingUp ? <Shield size={32} /> : <Lock size={32} />}
          </motion.div>

          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 text-center">
            {isSettingUp 
              ? (step === 'enter' ? 'Create Security PIN' : 'Confirm Your PIN')
              : 'Enter Security PIN'}
          </h2>
          
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 text-center px-4">
            {isSettingUp 
              ? 'Set a 6-digit PIN to secure your access to the shop space.'
              : `Welcome back, ${user.displayName}. Please enter your PIN.`}
          </p>

          {/* PIN Display */}
          <div className="flex gap-3 mb-8">
            {[...Array(isSettingUp ? 6 : (user.pin?.length || 4))].map((_, i) => (
              <motion.div
                key={i}
                animate={pin.length > i ? { scale: [1, 1.2, 1], backgroundColor: '#4f46e5' } : { scale: 1 }}
                className={`w-4 h-4 rounded-full border-2 transition-colors ${
                  pin.length > i 
                    ? 'bg-indigo-600 border-indigo-600' 
                    : 'border-slate-200 dark:border-slate-700 bg-transparent'
                }`}
              />
            ))}
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-red-500 text-xs font-bold mb-6 bg-red-50 dark:bg-red-500/10 px-4 py-2 rounded-full"
            >
              <AlertCircle size={14} />
              {error}
            </motion.div>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-4 w-full max-w-[280px]">
            {numbers.map((num, i) => (
              <button
                key={i}
                onClick={() => num === 'delete' ? handleDelete() : num !== '' && handleNumberClick(num)}
                disabled={num === '' || isVerifying}
                className={`
                  h-16 rounded-2xl flex items-center justify-center text-xl font-black transition-all
                  ${num === 'delete' 
                    ? 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10' 
                    : num === '' 
                      ? 'invisible' 
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-90'}
                `}
              >
                {num === 'delete' ? <Delete size={24} /> : num}
              </button>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 w-full flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <KeyRound size={12} />
              Secure Access System
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-red-500 transition-colors"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
