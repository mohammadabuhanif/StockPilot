import React, { useState, useEffect } from 'react';
import { db, doc, onSnapshot, updateDoc, setDoc, handleFirestoreError, OperationType, collection, query, orderBy, deleteField } from '../firebase';
import { Settings as SettingsType, AppUser, UserRole } from '../types';
import { Store, MapPin, Phone, Mail, FileText, Save, CheckCircle2, Database, Users, Shield, KeyRound, RefreshCw } from 'lucide-react';
import BackupButton from './BackupButton';

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType>({
    shopName: 'StockPilot Shop',
    shopAddress: '',
    shopPhone: '',
    shopEmail: '',
    memoFooter: 'Thank you for your business!'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as SettingsType);
      }
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'settings/global');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('email', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AppUser[];
      setAppUsers(usersData);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'users');
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleResetPin = async (userId: string) => {
    if (!window.confirm('Are you sure you want to reset this user\'s PIN? They will be prompted to set a new one on their next login.')) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        pin: deleteField()
      });
      alert('PIN reset successfully.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/global');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Store size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Shop Profile</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">These details will appear on your cash memos.</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Shop Name</label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  required
                  value={settings.shopName}
                  onChange={(e) => setSettings({ ...settings, shopName: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="e.g. Digital Shop"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={settings.shopPhone || ''}
                  onChange={(e) => setSettings({ ...settings, shopPhone: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="e.g. +880 1234 567890"
                />
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 text-slate-400" size={16} />
                <textarea
                  value={settings.shopAddress || ''}
                  onChange={(e) => setSettings({ ...settings, shopAddress: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[80px]"
                  placeholder="e.g. 123 Business Avenue, Dhaka, Bangladesh"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="email"
                  value={settings.shopEmail || ''}
                  onChange={(e) => setSettings({ ...settings, shopEmail: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="e.g. contact@shop.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Memo Footer Message</label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={settings.memoFooter || ''}
                  onChange={(e) => setSettings({ ...settings, memoFooter: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="e.g. Thank you for your business!"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {success && (
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 animate-in fade-in slide-in-from-left-2">
                  <CheckCircle2 size={16} />
                  <span className="text-xs font-bold">Settings saved!</span>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all disabled:opacity-50"
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Users size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">User Management</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Manage staff roles and permissions.</p>
          </div>
        </div>

        <div className="space-y-3">
          {appUsers.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                  {user.displayName.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{user.displayName}</p>
                  <p className="text-[10px] text-slate-500">{user.email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleResetPin(user.id)}
                  className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors"
                  title="Reset PIN"
                >
                  <RefreshCw size={14} />
                </button>
                <Shield size={14} className="text-slate-400" />
                <select
                  value={user.role}
                  onChange={(e) => handleUpdateUserRole(user.id, e.target.value as UserRole)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold outline-none dark:text-white"
                >
                  <option value="admin">Admin</option>
                  <option value="fixer">Fixer</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Database size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Data Management</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Securely backup your entire shop database.</p>
          </div>
        </div>
        
        <BackupButton />
        
        <p className="mt-4 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed italic">
          * This will export all products, sales, customers, expenses, and personal notes into a single JSON file that you can store safely on your computer or phone.
        </p>
      </div>

      <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-2xl p-4">
        <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-1">Pro Tip</h4>
        <p className="text-[10px] text-amber-700 dark:text-amber-500/80 leading-relaxed">
          The information you set here is used to generate professional cash memos. Make sure your address and phone number are correct so customers can contact you.
        </p>
      </div>
    </div>
  );
}
