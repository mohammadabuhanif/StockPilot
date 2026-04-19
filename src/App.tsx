/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { auth, signInWithPopup, googleProvider, signOut, onSnapshot, collection, db, query, orderBy, limit, handleFirestoreError, OperationType, getDocs, getDoc, setDoc, addDoc, doc, serverTimestamp, where } from './firebase';
import { User } from 'firebase/auth';
import { LayoutDashboard, Package, ShoppingCart, LogOut, AlertTriangle, TrendingUp, DollarSign, PackagePlus, X, Store, Menu, Moon, Sun, Heart, Zap, CloudCheck, Users, Receipt, Wrench, FileText } from 'lucide-react';
import { cn } from './lib/utils';
import PinLock from './components/PinLock';
import ErrorBoundary from './components/ErrorBoundary';
import { Logo } from './components/Logo';
import { HeartZap } from './components/HeartZap';
import { Product, Sale, ServiceOrder, Expense, Customer, Service, Settings as SettingsType, UserRole, AppUser, RepairJob } from './types';
import gsap from 'gsap';
import { motion, AnimatePresence } from 'motion/react';

// Lazy load heavy components
const Dashboard = lazy(() => import('./components/Dashboard'));
const Inventory = lazy(() => import('./components/Inventory'));
const Sales = lazy(() => import('./components/Sales'));
const PersonalCenter = lazy(() => import('./components/PersonalCenter'));
const ServiceCenter = lazy(() => import('./components/ServiceCenter'));
const Expenses = lazy(() => import('./components/Expenses'));
const Customers = lazy(() => import('./components/Customers'));
const Storefront = lazy(() => import('./components/Storefront'));
const Settings = lazy(() => import('./components/Settings'));
const FixerSpace = lazy(() => import('./components/FixerSpace'));
const Reports = lazy(() => import('./components/Reports'));

type Tab = 'dashboard' | 'inventory' | 'sales' | 'services' | 'expenses' | 'customers' | 'personal' | 'settings' | 'fixer' | 'reports';

// Track which tabs have been visited
function useVisitedTabs(activeTab: Tab) {
  const [visited, setVisited] = useState<Record<string, boolean>>({ [activeTab]: true });
  useEffect(() => {
    setVisited((prev) => ({ ...prev, [activeTab]: true }));
  }, [activeTab]);
  return visited;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('staff');
  const [isLocked, setIsLocked] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const visitedTabs = useVisitedTabs(activeTab);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [repairJobs, setRepairJobs] = useState<RepairJob[]>([]);
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const barcodeBuffer = useRef<string>('');
  const lastKeyTime = useRef<number>(0);

  const [currentHash, setCurrentHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const isShopRoute = currentHash === '' || currentHash === '#/' || currentHash.startsWith('#/shop');
  const isAdminRoute = currentHash.startsWith('#/admin');

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request') {
        console.log('Login cancelled by user');
        return;
      }
      console.error('Login failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Global Barcode Listener
  useEffect(() => {
    if (!user || isShopRoute || isLocked) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field (unless it's the barcode input itself)
      const activeElement = document.activeElement;
      const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
      
      // Barcode scanners are very fast. If the time between keys is > 150ms, it's likely manual typing.
      const currentTime = Date.now();
      if (currentTime - lastKeyTime.current > 150) {
        barcodeBuffer.current = '';
      }
      lastKeyTime.current = currentTime;

      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length >= 3) {
          e.preventDefault();
          const scannedBarcode = barcodeBuffer.current;
          barcodeBuffer.current = '';
          
          console.log('Global Barcode Detected:', scannedBarcode);

          // Logic: 
          // 1. If we are on any tab other than inventory/sales, switch to sales
          // 2. Dispatch a custom event so the active tab can handle it
          if (activeTab !== 'sales' && activeTab !== 'inventory') {
            setActiveTab('sales');
          }

          // Small delay to ensure tab switch completes before dispatching
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('barcodeScanned', { 
              detail: { barcode: scannedBarcode, source: 'global' } 
            }));
          }, 50);
        }
        barcodeBuffer.current = '';
      } else if (e.key.length === 1) {
        // Only accumulate alphanumeric characters to avoid control keys
        if (/[a-zA-Z0-9-]/.test(e.key)) {
          barcodeBuffer.current += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [user, isShopRoute, isLocked, activeTab]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (contentRef.current && !isShopRoute) {
      gsap.fromTo(contentRef.current, 
        { opacity: 0, y: 10 }, 
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
      );
    }
    // Close mobile menu when tab changes
    setIsMobileMenuOpen(false);
  }, [activeTab, isShopRoute]);

  // Inactivity Timer
  useEffect(() => {
    if (!user || isShopRoute || isLocked) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (!isLocked) {
          setIsLocked(true);
        }
      }, 60000); // 1 minute
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, [user, isShopRoute, isLocked]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user);
      if (user) {
        console.log("Logged in as:", user.email);
        
        // Fetch or create user record to get role
        const userDocRef = doc(db, 'users', user.uid);
        
        try {
          // First try to get the document by ID (most efficient and secure)
          const userDocSnap = await getDoc(userDocRef);
          
          if (!userDocSnap.exists()) {
            // New user, default role is staff (or admin if it's the owner)
            const role: UserRole = user.email === "abuhanifindiabased@gmail.com" ? 'admin' : 'staff';
            // Use setDoc with the uid as the document ID for better security rules matching
            const newUserData = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || 'User',
              role: role,
              createdAt: serverTimestamp()
            };
            await setDoc(userDocRef, newUserData);
            setUserRole(role);
            setAppUser({ ...newUserData, id: user.uid, createdAt: undefined } as any);
            setIsLocked(true); // Lock to set up PIN
          } else {
            const userData = userDocSnap.data() as AppUser;
            setUserRole(userData.role);
            setAppUser({ ...userData, id: user.uid });
            setIsLocked(true); // Lock on login
            if (userData.role === 'fixer') setActiveTab('fixer');
          }
        } catch (err) {
          console.error("Error fetching user role:", err);
          // Fallback to staff if fetch fails
          setUserRole('staff');
          setAppUser({
            id: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'User',
            role: 'staff'
          });
          setIsLocked(true);
        }
      } else {
        setAppUser(null);
        setIsLocked(false);
        setUserRole('staff');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isAdminRoute) return; // Don't fetch all data if not on admin route or not logged in

    const unsubscribers: (() => void)[] = [];

    // Admin-only data
    if (userRole === 'admin') {
      // Pre-populate services if empty
      const checkServices = async () => {
        const servicesSnap = await getDocs(collection(db, 'services'));
        if (servicesSnap.empty) {
          const defaultServices = [
            { name: 'Photocopy (B&W)', category: 'printing', basePrice: 5, description: 'Standard A4 black and white photocopy.' },
            { name: 'Color Print', category: 'printing', basePrice: 20, description: 'High quality color printing.' },
            { name: 'Passport Size Photo (4 copies)', category: 'printing', basePrice: 100, description: 'Standard passport size photo print.' },
            { name: 'Stamp Size Photo (8 copies)', category: 'printing', basePrice: 80, description: 'Small stamp size photo print.' },
            { name: 'Passport Appointment', category: 'document', basePrice: 500, description: 'Online application and appointment booking.' },
            { name: 'Name Change Application', category: 'document', basePrice: 1500, description: 'Legal document preparation for name change.' },
            { name: 'Tax Return Filing', category: 'document', basePrice: 1000, description: 'Annual income tax return submission.' }
          ];
          for (const s of defaultServices) {
            await addDoc(collection(db, 'services'), s);
          }
        }
      };
      checkServices();

      unsubscribers.push(onSnapshot(collection(db, 'products'), (snapshot) => {
        const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setProducts(productsData);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, 'products');
      }));

      unsubscribers.push(onSnapshot(query(collection(db, 'sales'), orderBy('timestamp', 'desc'), limit(50)), (snapshot) => {
        const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
        setSales(salesData);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, 'sales');
      }));

      unsubscribers.push(onSnapshot(query(collection(db, 'serviceOrders'), orderBy('createdAt', 'desc'), limit(30)), (snapshot) => {
        const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceOrder));
        setServiceOrders(ordersData);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, 'serviceOrders');
      }));

      unsubscribers.push(onSnapshot(collection(db, 'services'), (snapshot) => {
        const servicesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
        setServices(servicesData);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, 'services');
      }));

      unsubscribers.push(onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc'), limit(50)), (snapshot) => {
        const expensesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
        setExpenses(expensesData);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, 'expenses');
      }));

      unsubscribers.push(onSnapshot(query(collection(db, 'customers'), orderBy('totalSpent', 'desc'), limit(50)), (snapshot) => {
        const customersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
        setCustomers(customersData);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, 'customers');
      }));

      unsubscribers.push(onSnapshot(query(collection(db, 'repairJobs'), orderBy('createdAt', 'desc'), limit(50)), (snapshot) => {
        const jobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepairJob));
        setRepairJobs(jobsData);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, 'repairJobs');
      }));

      unsubscribers.push(onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
        if (docSnap.exists()) {
          setSettings(docSnap.data() as SettingsType);
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, 'settings/global');
      }));
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user, isShopRoute, userRole]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (isShopRoute && !isAdminRoute) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div></div>}>
          <Storefront user={user} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-200 relative overflow-hidden">
        {/* Digital Background */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-[120px]"></div>
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-md w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 p-10 text-center space-y-8 relative z-10"
        >
          <div className="space-y-4">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="bg-indigo-600 text-white w-24 h-24 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-indigo-500/30 dark:shadow-indigo-900/20"
            >
              <Logo className="w-14 h-14" />
            </motion.div>
            <div className="space-y-2">
              <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">StockPilot</h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Modern Inventory Management for Small Shops</p>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleLogin}
              className="w-full bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-black py-4 px-6 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 shadow-xl shadow-slate-200 dark:shadow-indigo-900/20 group"
            >
              <div className="bg-white rounded-full p-1 group-hover:scale-110 transition-transform">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              </div>
              Sign in with Google
            </button>
            
            <a 
              href="#/" 
              className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-black py-4 px-6 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <Store size={20} className="text-indigo-600 dark:text-indigo-400" />
              Visit Public Shop
            </a>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
              <CloudCheck size={14} className="text-emerald-500" />
              Secure Cloud Sync Active
            </p>
          </div>
        </motion.div>

        <p className="mt-8 text-slate-400 dark:text-slate-600 text-xs font-bold uppercase tracking-[0.2em] relative z-10">
          © {new Date().getFullYear()} Smart Digital Care
        </p>
      </div>
    );
  }

  const lowStockProducts = products.filter(p => p.stock <= p.minStock);

  return (
    <ErrorBoundary>
      <AnimatePresence mode="wait">
        {isLocked && appUser && !isShopRoute && (
          <PinLock 
            user={appUser} 
            onUnlock={() => setIsLocked(false)} 
            onPinSet={(pin) => setAppUser(prev => prev ? { ...prev, pin } : null)}
          />
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row transition-colors duration-200">
      
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-48 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col h-screen sticky top-0">
        <div className="p-3 flex items-center gap-2">
          <div className="bg-indigo-600 text-white p-1 rounded-lg shadow-sm">
            <Logo className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-slate-900 dark:text-white leading-tight">StockPilot</span>
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[7px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">Cloud Synced</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-2 lg:mt-0">
          {userRole === 'admin' && (
            <>
              <NavItem
                icon={<LayoutDashboard size={20} />}
                label="Dashboard"
                active={activeTab === 'dashboard'}
                onClick={() => setActiveTab('dashboard')}
              />
              <NavItem
                icon={<Package size={20} />}
                label="Inventory"
                active={activeTab === 'inventory'}
                onClick={() => setActiveTab('inventory')}
                badge={lowStockProducts.length > 0 ? lowStockProducts.length : undefined}
              />
              <NavItem
                icon={<ShoppingCart size={20} />}
                label="Sales (POS)"
                active={activeTab === 'sales'}
                onClick={() => setActiveTab('sales')}
              />
              <NavItem
                icon={<Zap size={20} />}
                label="Service Center"
                active={activeTab === 'services'}
                onClick={() => setActiveTab('services')}
              />
              <NavItem
                icon={<Receipt size={20} />}
                label="Expenses"
                active={activeTab === 'expenses'}
                onClick={() => setActiveTab('expenses')}
              />
              <NavItem
                icon={<Users size={20} />}
                label="Customers"
                active={activeTab === 'customers'}
                onClick={() => setActiveTab('customers')}
              />
            </>
          )}

          {(userRole === 'admin' || userRole === 'fixer') && (
            <NavItem
              icon={<Wrench size={20} />}
              label="Fixer Space"
              active={activeTab === 'fixer'}
              onClick={() => setActiveTab('fixer')}
            />
          )}

          <NavItem
            icon={<Heart size={20} />}
            label="Personal Center"
            active={activeTab === 'personal'}
            onClick={() => setActiveTab('personal')}
          />
          
          {userRole === 'admin' && (
            <>
              <NavItem
                icon={<FileText size={20} />}
                label="Reports"
                active={activeTab === 'reports'}
                onClick={() => setActiveTab('reports')}
              />
              <NavItem
                icon={<Receipt size={20} />}
                label="Settings"
                active={activeTab === 'settings'}
                onClick={() => setActiveTab('settings')}
              />
            </>
          )}
          <div className="pt-4 pb-2">
            <p className="px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Public</p>
          </div>
          <a
            href="#/"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200"
          >
            <Store size={20} />
            <span className="flex-1 text-left">View Storefront</span>
          </a>
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-full flex items-center gap-3 px-4 py-3 mb-2 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            <span className="flex-1 text-left">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          
          <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 mb-3">
            <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-700 shadow-sm" alt="User" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{user.displayName}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="lg:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 text-white p-1.5 rounded-lg shadow-sm">
            <Logo className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-slate-900 dark:text-white leading-none">StockPilot</span>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider">Cloud Synced</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-2 sm:p-3 lg:p-4 overflow-x-hidden pb-24 lg:pb-4 flex flex-col">
        <div className="flex-1">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white capitalize">{activeTab}</h2>
              <p className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs">Manage your shop's inventory and sales efficiently.</p>
            </div>
            {lowStockProducts.length > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-500 px-3 py-1.5 rounded-full border border-amber-100 dark:border-amber-500/20 animate-pulse w-full sm:w-auto justify-center">
                <AlertTriangle size={16} />
                <span className="text-xs font-medium">{lowStockProducts.length} items low in stock</span>
              </div>
            )}
          </header>

          <div className={cn(activeTab !== 'personal' && "space-y-4")} ref={contentRef}>
            <ErrorBoundary>
              <Suspense fallback={<div className="flex justify-center items-center py-12"><div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></div></div>}>
                {/* CSS Display toggles replacing conditional mounting to make tab switching instant */}
                <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
                  {visitedTabs['dashboard'] && userRole === 'admin' && <Dashboard products={products} sales={sales} serviceOrders={serviceOrders} expenses={expenses} customers={customers} repairJobs={repairJobs} />}
                </div>
                <div className={activeTab === 'inventory' ? 'block' : 'hidden'}>
                  {visitedTabs['inventory'] && userRole === 'admin' && <Inventory products={products} settings={settings} />}
                </div>
                <div className={activeTab === 'sales' ? 'block' : 'hidden'}>
                  {visitedTabs['sales'] && userRole === 'admin' && <Sales products={products} sales={sales} customers={customers} services={services} settings={settings} />}
                </div>
                <div className={activeTab === 'services' ? 'block' : 'hidden'}>
                  {visitedTabs['services'] && userRole === 'admin' && <ServiceCenter settings={settings} />}
                </div>
                <div className={activeTab === 'expenses' ? 'block' : 'hidden'}>
                  {visitedTabs['expenses'] && userRole === 'admin' && <Expenses />}
                </div>
                <div className={activeTab === 'customers' ? 'block' : 'hidden'}>
                  {visitedTabs['customers'] && userRole === 'admin' && <Customers />}
                </div>
                <div className={activeTab === 'personal' ? 'block' : 'hidden'}>
                  {visitedTabs['personal'] && <PersonalCenter products={products} sales={sales} appUser={appUser} />}
                </div>
                <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
                  {visitedTabs['settings'] && userRole === 'admin' && <Settings />}
                </div>
                <div className={activeTab === 'reports' ? 'block' : 'hidden'}>
                  {visitedTabs['reports'] && userRole === 'admin' && <Reports products={products} sales={sales} serviceOrders={serviceOrders} expenses={expenses} customers={customers} settings={settings} />}
                </div>
                <div className={activeTab === 'fixer' ? 'block' : 'hidden'}>
                  {visitedTabs['fixer'] && (userRole === 'admin' || userRole === 'fixer') && <FixerSpace userRole={userRole} />}
                </div>
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 py-6 border-t border-slate-200 dark:border-slate-800 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
            Made with <HeartZap className="w-4 h-4" /> by <span className="font-bold text-slate-700 dark:text-slate-300">Abu Hanif</span>
          </p>
        </footer>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex justify-around items-center p-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] z-40 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
        {userRole === 'admin' ? (
          <>
            <MobileNavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
            <MobileNavItem icon={<Package size={20} />} label="Stock" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} badge={lowStockProducts.length > 0 ? lowStockProducts.length : undefined} />
            <MobileNavItem icon={<ShoppingCart size={20} />} label="POS" active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} />
            <MobileNavItem icon={<Zap size={20} />} label="Services" active={activeTab === 'services'} onClick={() => setActiveTab('services')} />
          </>
        ) : (
          <>
            {userRole === 'fixer' && <MobileNavItem icon={<Wrench size={20} />} label="Fixer" active={activeTab === 'fixer'} onClick={() => setActiveTab('fixer')} />}
            <MobileNavItem icon={<Heart size={20} />} label="Personal" active={activeTab === 'personal'} onClick={() => setActiveTab('personal')} />
          </>
        )}
        <MobileNavItem icon={<Menu size={20} />} label="More" active={isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
      </nav>

      {/* Mobile "More" Slide-up Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="bg-white dark:bg-slate-900 w-full rounded-t-[2.5rem] p-6 pb-[calc(3rem+env(safe-area-inset-bottom))] relative z-50 animate-in slide-in-from-bottom-full duration-300 shadow-2xl">
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-6" />
            
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider">Main Menu</h3>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="grid grid-cols-3 gap-3 mb-8">
              {userRole === 'admin' && (
                <>
                  <MenuButton icon={<FileText size={22} />} label="Reports" active={activeTab === 'reports'} onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }} color="indigo" />
                  <MenuButton icon={<Receipt size={22} />} label="Expenses" active={activeTab === 'expenses'} onClick={() => { setActiveTab('expenses'); setIsMobileMenuOpen(false); }} color="red" />
                  <MenuButton icon={<Users size={22} />} label="Customers" active={activeTab === 'customers'} onClick={() => { setActiveTab('customers'); setIsMobileMenuOpen(false); }} color="blue" />
                </>
              )}
              {(userRole === 'admin' || userRole === 'fixer') && (
                <MenuButton icon={<Wrench size={22} />} label="Fixer" active={activeTab === 'fixer'} onClick={() => { setActiveTab('fixer'); setIsMobileMenuOpen(false); }} color="blue" />
              )}
              <MenuButton icon={<Heart size={22} />} label="Personal" active={activeTab === 'personal'} onClick={() => { setActiveTab('personal'); setIsMobileMenuOpen(false); }} color="pink" />
              {userRole === 'admin' && (
                <MenuButton icon={<LayoutDashboard size={22} />} label="Settings" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }} color="blue" />
              )}
            </div>

            <div className="space-y-3 mb-8">
              <a
                href="#/"
                className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-base font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200 border border-slate-100 dark:border-slate-800"
              >
                <Store size={22} className="text-indigo-600" />
                <span className="flex-1">View Public Storefront</span>
              </a>
              
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-base font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 border border-slate-100 dark:border-slate-800"
              >
                {isDarkMode ? <Sun size={22} className="text-amber-500" /> : <Moon size={22} className="text-indigo-600" />}
                <span className="flex-1 text-left">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 mb-6 border border-slate-100 dark:border-slate-800">
              <img src={user.photoURL || ''} className="w-12 h-12 rounded-full border-2 border-white dark:border-slate-700 shadow-sm" alt="User" />
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-slate-900 dark:text-white truncate">{user.displayName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-3 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-xl hover:bg-red-100 transition-colors"
                title="Sign Out"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}

function NavItem({ icon, label, active, onClick, badge }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-200",
        active
          ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm shadow-indigo-100 dark:shadow-none"
          : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"
      )}
    >
      {React.cloneElement(icon as any, { size: 18 })}
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && (
        <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
          {badge}
        </span>
      )}
    </button>
  );
}

function MobileNavItem({ icon, label, active, onClick, badge }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all duration-300",
        active
          ? "text-indigo-600 dark:text-indigo-400"
          : "text-slate-400 dark:text-slate-500"
      )}
    >
      <div className={cn("transition-all duration-300", active ? "-translate-y-2.5 scale-110" : "scale-100")}>
        {icon}
      </div>
      <span className={cn(
        "text-[9px] font-black uppercase tracking-tighter absolute bottom-1 transition-all duration-300",
        active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      )}>
        {label}
      </span>
      {badge !== undefined && (
        <span className="absolute top-1 right-2 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center shadow-lg shadow-red-200 dark:shadow-none border border-white dark:border-slate-900">
          {badge}
        </span>
      )}
      {active && (
        <motion.div 
          layoutId="activeTab"
          className="absolute -top-1.5 w-1 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-full"
        />
      )}
    </button>
  );
}

function MenuButton({ icon, label, active, onClick, color }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, color: 'red' | 'blue' | 'pink' | 'indigo' }) {
  const colors = {
    red: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
    pink: "bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400",
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center p-4 rounded-2xl transition-all active:scale-95 border",
        active ? "border-indigo-200 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900"
      )}
    >
      <div className={cn("p-3 rounded-xl mb-2 shadow-sm", colors[color])}>
        {icon}
      </div>
      <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">{label}</span>
    </button>
  );
}

