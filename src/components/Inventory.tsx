import { useState, useEffect, useRef, useMemo } from 'react';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, Timestamp, handleFirestoreError, OperationType, onSnapshot, query, orderBy, limit } from '../firebase';
import { Product, StockLog, Settings } from '../types';
import { 
  Plus, 
  Minus,
  Search, 
  Edit2, 
  Trash2, 
  X, 
  Package, 
  AlertCircle, 
  Image as ImageIcon, 
  GripHorizontal, 
  ChevronRight, 
  Filter, 
  MoreHorizontal, 
  Download, 
  Calendar,
  History,
  MessageSquare,
  ArrowUpRight,
  ArrowDownRight,
  ClipboardList,
  TrendingUp,
  DollarSign,
  PackagePlus,
  CheckCircle2,
  AlertTriangle,
  Barcode as BarcodeIcon,
  Printer
} from 'lucide-react';
import { cn, formatAppTime, formatAppDateTime } from '../lib/utils';
import gsap from 'gsap';
import { motion, AnimatePresence } from 'motion/react';
import { format, isSameDay } from 'date-fns';
import BarcodeGenerator from 'react-barcode';

interface InventoryProps {
  products: Product[];
  settings: Settings | null;
}

export default function Inventory({ products, settings }: InventoryProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [printingProduct, setPrintingProduct] = useState<Product | null>(null);
  const [stockInMode, setStockInMode] = useState(false);
  const [bulkUpdateMode, setBulkUpdateMode] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [prefilledBarcode, setPrefilledBarcode] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [stockHistory, setStockHistory] = useState<StockLog[]>([]);
  const [logToDelete, setLogToDelete] = useState<{logId: string, productId: string} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const groupedHistory = useMemo(() => {
    const groups: { [key: string]: StockLog[] } = {};
    stockHistory.forEach(log => {
      if (!log.timestamp) return;
      const date = format(log.timestamp.toDate(), 'yyyy-MM-dd');
      if (!groups[date]) groups[date] = [];
      groups[date].push(log);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [stockHistory]);

  const stockInsights = useMemo(() => {
    return stockHistory.reduce((acc, log) => {
      if (log.type === 'addition') acc.totalAdded += log.amount;
      if (log.type === 'sale') acc.totalSold += log.amount;
      return acc;
    }, { totalAdded: 0, totalSold: 0 });
  }, [stockHistory]);

  const handleDeleteLog = async (logId: string, productId: string) => {
    try {
      await deleteDoc(doc(db, 'products', productId, 'stockHistory', logId));
      setLogToDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${productId}/stockHistory/${logId}`);
    }
  };

  const inventoryStats = useMemo(() => {
    const totalProducts = products.length;
    const totalStockValue = products.reduce((acc, p) => acc + (p.stock * p.price), 0);
    const lowStockCount = products.filter(p => p.stock <= p.minStock).length;
    const newToday = products.filter(p => p.createdAt && isSameDay(p.createdAt.toDate(), new Date())).length;
    
    return { totalProducts, totalStockValue, lowStockCount, newToday };
  }, [products]);

  const [printQuantity, setPrintQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const tableRef = useRef<HTMLTableSectionElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S for search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Ctrl/Cmd + A for new product
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (!isModalOpen) {
          setEditingProduct(null);
          setImageUrlInput('');
          setIsModalOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Barcode listener for Stock In mode
  useEffect(() => {
    if (!stockInMode) return;

    const focusInterval = setInterval(() => {
      const activeElement = document.activeElement;
      const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
      if (!isModalOpen && !isInput) {
        barcodeInputRef.current?.focus();
      }
    }, 1000);

    return () => clearInterval(focusInterval);
  }, [stockInMode, isModalOpen]);

  const processBarcodeStockIn = async (code: string) => {
    const cleanCode = code.trim().toLowerCase();
    if (!cleanCode) return;

    const product = products.find(p => 
      (p.barcode && p.barcode.trim().toLowerCase() === cleanCode) ||
      (p.sku && p.sku.trim().toLowerCase() === cleanCode) ||
      (p.id.toLowerCase().includes(cleanCode) && cleanCode.length >= 5)
    );
    if (product) {
      try {
        const newStock = product.stock + 1;
        await updateDoc(doc(db, 'products', product.id), {
          stock: newStock,
          updatedAt: Timestamp.now()
        });

        await addDoc(collection(db, 'products', product.id, 'stockHistory'), {
          type: 'addition',
          amount: 1,
          previousStock: product.stock,
          newStock: newStock,
          timestamp: Timestamp.now(),
          note: 'Stock added via Barcode Scanner (Stock In Mode)'
        });

        setSuccessMessage(`Added 1 unit to ${product.name}`);
        setTimeout(() => setSuccessMessage(null), 2000);
        setBarcodeInput('');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `products/${product.id}`);
      }
    } else {
      if (window.confirm(`Product with barcode "${code}" not found. Would you like to add it now?`)) {
        setEditingProduct(null);
        setImageUrlInput('');
        setPrefilledBarcode(code);
        setIsModalOpen(true);
      }
      setBarcodeInput('');
    }
  };

  const handleBarcodeStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    processBarcodeStockIn(barcodeInput);
  };

  // Global Barcode Listener for Inventory
  useEffect(() => {
    const handleGlobalBarcode = (e: any) => {
      const { barcode } = e.detail;
      if (!barcode) return;

      if (stockInMode) {
        processBarcodeStockIn(barcode);
      } else {
        // If not in stock in mode, just search for it
        setSearchQuery(barcode);
        setSuccessMessage(`Searching for barcode: ${barcode}`);
        setTimeout(() => setSuccessMessage(null), 2000);
      }
    };

    window.addEventListener('barcodeScanned', handleGlobalBarcode);
    return () => window.removeEventListener('barcodeScanned', handleGlobalBarcode);
  }, [products, stockInMode]);

  const handleQuickStockUpdate = async (product: Product, amount: number) => {
    try {
      const newStock = Math.max(0, product.stock + amount);
      if (newStock === product.stock) return;

      await updateDoc(doc(db, 'products', product.id), {
        stock: newStock,
        updatedAt: Timestamp.now()
      });

      await addDoc(collection(db, 'products', product.id, 'stockHistory'), {
        type: amount > 0 ? 'addition' : 'adjustment',
        amount: Math.abs(amount),
        previousStock: product.stock,
        newStock: newStock,
        timestamp: Timestamp.now(),
        note: `Quick stock ${amount > 0 ? 'addition' : 'adjustment'}`
      });

      setSuccessMessage(`${product.name} stock updated to ${newStock}`);
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${product.id}`);
    }
  };

  useEffect(() => {
    if (tableRef.current && products.length > 0) {
      const rows = tableRef.current.querySelectorAll('tr');
      if (rows.length > 0) {
        gsap.fromTo(rows, 
          { opacity: 0, x: -10 }, 
          { opacity: 1, x: 0, duration: 0.3, stagger: 0.05, ease: 'power2.out' }
        );
      }
    }
    if (mobileRef.current && products.length > 0) {
      const cards = mobileRef.current.children;
      if (cards.length > 0) {
        gsap.fromTo(cards,
          { opacity: 0, scale: 0.95 },
          { opacity: 1, scale: 1, duration: 0.3, stagger: 0.05, ease: 'power2.out' }
        );
      }
    }
  }, [products, searchQuery]);

  useEffect(() => {
    if (historyProduct) {
      const q = query(
        collection(db, 'products', historyProduct.id, 'stockHistory'),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StockLog[];
        setStockHistory(logs);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `products/${historyProduct.id}/stockHistory`);
      });
      return () => unsubscribe();
    }
  }, [historyProduct]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const notes = formData.get('notes') as string || '';
    
    try {
      const productData = {
        name: (formData.get('name') as string) || '',
        brand: (formData.get('brand') as string) || '',
        category: (formData.get('category') as string) || '',
        description: (formData.get('description') as string) || '',
        notes: notes,
        isFeatured: formData.get('isFeatured') === 'on',
        barcode: (formData.get('barcode') as string) || '',
        sku: (formData.get('sku') as string) || '',
        price: Number(formData.get('price')) || 0,
        cost: Number(formData.get('cost')) || 0,
        stock: Number(formData.get('stock')) || 0,
        minStock: Number(formData.get('minStock')) || 0,
        imageUrl: imageUrlInput || '',
        updatedAt: Timestamp.now(),
      };

      if (editingProduct) {
        const oldStock = editingProduct.stock;
        const newStock = productData.stock;
        
        // Detect other changes for history
        const changes: string[] = [];
        if (editingProduct.name !== productData.name) changes.push(`Name: ${editingProduct.name} → ${productData.name}`);
        if (editingProduct.brand !== productData.brand) changes.push(`Brand: ${editingProduct.brand || 'None'} → ${productData.brand || 'None'}`);
        if (editingProduct.price !== productData.price) changes.push(`Price: ৳${editingProduct.price} → ৳${productData.price}`);
        if (editingProduct.cost !== productData.cost) changes.push(`Cost: ৳${editingProduct.cost} → ৳${productData.cost}`);
        if (editingProduct.category !== productData.category) changes.push(`Category: ${editingProduct.category} → ${productData.category}`);

        await updateDoc(doc(db, 'products', editingProduct.id), {
          ...productData,
          updatedAt: Timestamp.now(),
        });

        if (newStock !== oldStock || changes.length > 0) {
          const historyNote = [
            changes.length > 0 ? `Updated: ${changes.join(', ')}` : '',
            newStock !== oldStock ? (newStock > oldStock ? `Stock added: ${newStock - oldStock} units` : `Stock adjusted: ${oldStock - newStock} units`) : '',
            notes ? `Note: ${notes}` : ''
          ].filter(Boolean).join(' | ');

          await addDoc(collection(db, 'products', editingProduct.id, 'stockHistory'), {
            type: newStock !== oldStock ? (newStock > oldStock ? 'addition' : 'adjustment') : 'adjustment',
            amount: Math.abs(newStock - oldStock),
            previousStock: oldStock,
            newStock: newStock,
            timestamp: Timestamp.now(),
            note: historyNote || 'Product details updated'
          });
        }
      } else {
        const docRef = await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        // Initial stock log
        if (productData.stock > 0) {
          await addDoc(collection(db, 'products', docRef.id, 'stockHistory'), {
            type: 'addition',
            amount: productData.stock,
            previousStock: 0,
            newStock: productData.stock,
            timestamp: Timestamp.now(),
            note: 'Initial stock'
          });
        }
      }
      
      closeModal();
    } catch (error: any) {
      console.error("Inventory handleSubmit error:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setError(errorMsg);
      // We don't re-throw here to avoid crashing the component, 
      // handleFirestoreError already logged it.
      try {
        handleFirestoreError(error, editingProduct ? OperationType.UPDATE : OperationType.CREATE, 'products');
      } catch (e) {
        // handleFirestoreError throws, but we already set the error state
      }
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setImageUrlInput('');
    setPrefilledBarcode('');
    setError(null);
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Barcode', 'Name', 'Category', 'Price', 'Cost', 'Stock', 'Min Stock', 'Featured', 'Added Date'];
    const rows = products.map(p => [
      p.id,
      p.barcode || '',
      p.name,
      p.category,
      p.price,
      p.cost,
      p.stock,
      p.minStock,
      p.isFeatured ? 'Yes' : 'No',
      p.createdAt ? format(p.createdAt.toDate(), 'yyyy-MM-dd HH:mm:ss') : 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    // Automatic one-time reset of all dates to today as requested
    const hasReset = localStorage.getItem('inventory_dates_reset_v1');
    if (!hasReset && products.length > 0) {
      const performInitialReset = async () => {
        try {
          const batchPromises = products.map(product => 
            updateDoc(doc(db, 'products', product.id), {
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now()
            })
          );
          await Promise.all(batchPromises);
          localStorage.setItem('inventory_dates_reset_v1', 'true');
          console.log('Initial inventory dates reset to today completed.');
        } catch (err) {
          console.error('Failed to perform initial date reset:', err);
        }
      };
      performInitialReset();
    }
  }, [products.length]);

  const resetAllDates = async () => {
    setShowResetConfirm(false);
    setLoading(true);
    setError(null);
    try {
      const batchPromises = products.map(product => 
        updateDoc(doc(db, 'products', product.id), {
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        })
      );
      await Promise.all(batchPromises);
      setSuccessMessage('All product dates have been reset to today.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error("Inventory resetAllDates error:", error);
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;
    setLoading(true);
    setError(null);
    try {
      await deleteDoc(doc(db, 'products', deletingProduct.id));
      setDeletingProduct(null);
    } catch (error: any) {
      console.error("Inventory handleDelete error:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setError(errorMsg);
      try {
        handleFirestoreError(error, OperationType.DELETE, 'products');
      } catch (e) {}
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      const matchesBrand = selectedBrand === 'all' || p.brand === selectedBrand;

      return matchesSearch && matchesCategory && matchesBrand;
    });

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [products, searchQuery, selectedCategory, selectedBrand]);

  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => {
      if (p.category) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }
    });
    const cats = Object.keys(counts).sort();
    return [
      { name: 'all', count: products.length },
      ...cats.map(cat => ({ name: cat, count: counts[cat] }))
    ];
  }, [products]);

  const brands = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => {
      if (p.brand) {
        counts[p.brand] = (counts[p.brand] || 0) + 1;
      }
    });
    const brs = Object.keys(counts).sort();
    return [
      { name: 'all', count: products.length },
      ...brs.map(brand => ({ name: brand, count: counts[brand] }))
    ];
  }, [products]);

  // Group products by creation date
  const productsByDate = products.reduce((acc, product) => {
    if (!product.createdAt) return acc;
    const dateStr = format(product.createdAt.toDate(), 'yyyy-MM-dd');
    acc[dateStr] = (acc[dateStr] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedDates = Object.entries(productsByDate)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 5); // Show last 5 days

  return (
    <div className="space-y-4 min-h-[600px]" ref={containerRef}>
      {/* Stock In Mode Banner */}
      <AnimatePresence>
        {stockInMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-emerald-600 text-white p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg shadow-emerald-100 dark:shadow-none mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <BarcodeIcon size={24} className="animate-pulse" />
                </div>
                <div>
                  <h4 className="font-black uppercase tracking-tight">Stock Arrival Mode Active</h4>
                  <p className="text-xs text-emerald-100">Scan any product barcode to increment its stock by 1 unit automatically.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <form onSubmit={handleBarcodeStockIn} className="relative flex-1 md:w-64">
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Scanning..."
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 placeholder:text-white/50"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Live</span>
                  </div>
                </form>
                <button
                  onClick={() => setStockInMode(false)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inventory Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Package size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Items</p>
              <h4 className="text-lg font-black text-slate-900 dark:text-white">{inventoryStats.totalProducts}</h4>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stock Value</p>
              <h4 className="text-lg font-black text-slate-900 dark:text-white">৳{inventoryStats.totalStockValue.toLocaleString()}</h4>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Low Stock</p>
              <h4 className="text-lg font-black text-slate-900 dark:text-white">{inventoryStats.lowStockCount}</h4>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
              <PackagePlus size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">New Today</p>
              <h4 className="text-lg font-black text-slate-900 dark:text-white">+{inventoryStats.newToday}</h4>
            </div>
          </div>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Inventory Management</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Track and manage your product stock levels.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] md:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search products... (⌘S)"
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none min-w-[140px]">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full appearance-none pl-9 pr-8 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white transition-all cursor-pointer font-bold capitalize"
              >
                {categories.map(cat => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name === 'all' ? `All Categories (${cat.count})` : `${cat.name} (${cat.count})`}
                  </option>
                ))}
              </select>
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>

            <div className="relative flex-1 sm:flex-none min-w-[140px]">
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full appearance-none pl-9 pr-8 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white transition-all cursor-pointer font-bold capitalize"
              >
                {brands.map(brand => (
                  <option key={brand.name} value={brand.name}>
                    {brand.name === 'all' ? `All Brands (${brand.count})` : `${brand.name} (${brand.count})`}
                  </option>
                ))}
              </select>
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
            
            <button
              onClick={() => setShowResetConfirm(true)}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-all"
              title="Reset All Dates to Today"
            >
              <Calendar size={18} />
            </button>

            <button
              onClick={exportToCSV}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-all"
              title="Export to CSV"
            >
              <Download size={18} />
            </button>

            <button
              onClick={() => setStockInMode(!stockInMode)}
              className={cn(
                "p-2 rounded-xl transition-all border flex items-center gap-2 px-3",
                stockInMode 
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100 dark:shadow-none" 
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700"
              )}
              title="Stock Arrival Mode (Scanner)"
            >
              <BarcodeIcon size={18} />
              <span className="text-xs font-bold hidden md:inline">Stock In</span>
            </button>

            <button
              onClick={() => setBulkUpdateMode(true)}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-all flex items-center gap-2 px-3"
              title="Bulk Stock Update"
            >
              <TrendingUp size={18} />
              <span className="text-xs font-bold hidden md:inline">Bulk Update</span>
            </button>

            <button
              onClick={() => {
                setEditingProduct(null);
                setImageUrlInput('');
                setIsModalOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-black rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-200 dark:shadow-none"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Add Product</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden" ref={mobileRef}>
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all group">
            <div className="flex items-start gap-4">
              <div className="bg-slate-100 dark:bg-slate-800 w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Package size={20} className="text-slate-400 dark:text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{product.name}</h4>
                  {product.brand && (
                    <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1 rounded-sm uppercase tracking-wider">
                      {product.brand}
                    </span>
                  )}
                  {product.barcode && (
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[8px] font-mono px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                      {product.barcode}
                    </span>
                  )}
                  {product.isFeatured && (
                    <span className="bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase">
                      ★
                    </span>
                  )}
                  {product.createdAt && isSameDay(product.createdAt.toDate(), new Date()) && (
                    <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                      New
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{product.category}</p>
                
                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Stock</span>
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "text-sm font-bold",
                        product.stock <= product.minStock ? "text-amber-600 dark:text-amber-500" : "text-slate-900 dark:text-white"
                      )}>
                        {product.stock}
                      </span>
                      {product.stock <= product.minStock && (
                        <AlertCircle size={14} className="text-amber-500" />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Status</span>
                    {product.stock === 0 ? (
                      <span className="text-[10px] font-black text-red-600 uppercase tracking-wider">Out</span>
                    ) : product.stock <= product.minStock ? (
                      <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Low</span>
                    ) : (
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">OK</span>
                    )}
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Price</span>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">৳{product.price.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar size={10} />
                      Added: {product.createdAt ? (isSameDay(product.createdAt.toDate(), new Date()) ? 'Today' : format(product.createdAt.toDate(), 'MMM dd, yyyy')) : 'Pre-History'}
                    </span>
                    <span className="flex items-center gap-1">
                      <History size={10} />
                      Modified: {product.updatedAt ? format(product.updatedAt.toDate(), 'MMM dd, ') + formatAppTime(product.updatedAt.toDate(), false) : 'Never'}
                    </span>
                  </div>
                  <button 
                    onClick={() => setHistoryProduct(product)}
                    className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline self-end"
                  >
                    View Pulse
                  </button>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setPrintingProduct(product)}
                className="flex items-center justify-center gap-2 py-3 text-xs font-black text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 border border-slate-100 dark:border-slate-700/50"
              >
                <Printer size={16} />
                Label
              </button>
              <button
                onClick={() => setHistoryProduct(product)}
                className="flex items-center justify-center gap-2 py-3 text-xs font-black text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 border border-slate-100 dark:border-slate-700/50"
              >
                <History size={16} />
                History
              </button>
              <button
                onClick={() => {
                  setEditingProduct(product);
                  setImageUrlInput(product.imageUrl || '');
                  setIsModalOpen(true);
                }}
                className="flex items-center justify-center gap-2 py-3 text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all active:scale-95 border border-indigo-100/50 dark:border-indigo-500/20"
              >
                <Edit2 size={16} />
                Edit
              </button>
              <button
                onClick={() => setDeletingProduct(product)}
                className="flex items-center justify-center gap-2 py-3 text-xs font-black text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-2xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-all active:scale-95 border border-red-100/50 dark:border-red-500/20"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </div>
        ))}
        {filteredProducts.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
            <Package size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-bold">No products found matching your search.</p>
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Product Info</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Barcode</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Category</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pricing (৳)</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Inventory</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Last Modified</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Added Date</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800" ref={tableRef}>
            {filteredProducts.map((product) => (
              <tr key={product.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-slate-100 dark:bg-slate-800 w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Package size={18} className="text-slate-400 dark:text-slate-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-slate-900 dark:text-white">{product.name}</p>
                        {product.brand && (
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                            {product.brand}
                          </span>
                        )}
                        {product.isFeatured && (
                          <span className="bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                            ★
                          </span>
                        )}
                        {product.createdAt && isSameDay(product.createdAt.toDate(), new Date()) && (
                          <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">#{product.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {product.barcode ? (
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <BarcodeIcon size={14} className="opacity-50" />
                      <span className="text-[10px] font-mono font-bold tracking-wider">{product.barcode}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">No Barcode</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-lg border border-indigo-100 dark:border-indigo-500/20">
                    {product.category}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">৳{product.price.toLocaleString()}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Cost: ৳{product.cost.toLocaleString()}</p>
                      <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 rounded-md">
                        +{(((product.price - product.cost) / product.cost) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <span className={cn(
                        "font-bold text-sm",
                        product.stock <= product.minStock ? "text-amber-600 dark:text-amber-500" : "text-slate-900 dark:text-white"
                      )}>
                        {product.stock} units
                      </span>
                      <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            product.stock <= product.minStock ? "bg-amber-500" : "bg-emerald-500"
                          )}
                          style={{ width: `${Math.min((product.stock / (product.minStock * 3)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    {product.stock <= product.minStock && (
                      <AlertCircle size={16} className="text-amber-500 animate-pulse" />
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {product.stock === 0 ? (
                    <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-wider">
                      <X size={12} />
                      Out of Stock
                    </span>
                  ) : product.stock <= product.minStock ? (
                    <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider">
                      <AlertTriangle size={12} />
                      Low Stock
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                      <CheckCircle2 size={12} />
                      In Stock
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {product.updatedAt ? format(product.updatedAt.toDate(), 'MMM dd, yyyy') : 'Never'}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                      {product.updatedAt ? formatAppTime(product.updatedAt.toDate(), false) : '--:--'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {product.createdAt ? (isSameDay(product.createdAt.toDate(), new Date()) ? 'Today' : format(product.createdAt.toDate(), 'MMM dd, yyyy')) : 'Pre-History'}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                      {product.createdAt ? formatAppTime(product.createdAt.toDate(), false) : '--:--'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => setPrintingProduct(product)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg border border-slate-200 dark:border-slate-700 transition-all group/btn"
                      title="Print Barcode Label"
                    >
                      <Printer size={14} className="group-hover/btn:scale-110 transition-transform" />
                      <span className="text-[10px] font-black uppercase tracking-wider">Label</span>
                    </button>
                    <button
                      onClick={() => setHistoryProduct(product)}
                      className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg border border-transparent hover:border-indigo-100 dark:hover:border-indigo-500/20 transition-all"
                      title="Stock History"
                    >
                      <History size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setEditingProduct(product);
                        setImageUrlInput(product.imageUrl || '');
                        setIsModalOpen(true);
                      }}
                      className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg border border-transparent hover:border-indigo-100 dark:hover:border-indigo-500/20 transition-all"
                      title="Edit Product"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setDeletingProduct(product)}
                      className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg border border-transparent hover:border-red-100 dark:hover:border-red-500/20 transition-all"
                      title="Delete Product"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>

      {/* Side Drawer (Proper Treatment for Add/Edit) */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-[70] flex flex-col border-l border-slate-200 dark:border-slate-800 h-[100dvh]"
            >
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {editingProduct ? 'Edit Product' : 'Add New Product'}
                    </h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Update your inventory details</p>
                  </div>
                  {editingProduct && (
                    <button
                      type="button"
                      onClick={() => setPrintingProduct(editingProduct)}
                      className="ml-2 p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all border border-indigo-100 dark:border-indigo-500/20 flex items-center gap-1.5 px-3"
                    >
                      <Printer size={14} />
                      <span className="text-[10px] font-bold uppercase">Print Label</span>
                    </button>
                  )}
                </div>
                <button 
                  onClick={closeModal} 
                  className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <form id="product-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                {error && (
                  <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 p-3 rounded-xl flex gap-2 items-start">
                    <AlertCircle className="text-red-600 shrink-0" size={16} />
                    <p className="text-[11px] text-red-700 dark:text-red-400 leading-relaxed">{error}</p>
                  </div>
                )}

                <div className="space-y-6">
                  {/* Section: Identity */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-1 bg-indigo-500 rounded-full" />
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Identity & Info</label>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 ml-1">SKU</label>
                          <input
                            name="sku"
                            defaultValue={editingProduct?.sku}
                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white transition-all font-mono"
                            placeholder="e.g. ADC-25W-001"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 ml-1">Barcode (12 Digits)</label>
                          <div className="relative">
                            <BarcodeIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                              name="barcode"
                              id="barcode-input"
                              defaultValue={editingProduct?.barcode || prefilledBarcode}
                              className="w-full pl-9 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white transition-all font-mono"
                              placeholder="Scan or enter..."
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            const form = (e.currentTarget.closest('form') as HTMLFormElement);
                            const name = (form.querySelector('[name="name"]') as HTMLInputElement).value;
                            const category = (form.querySelector('[name="category"]') as HTMLInputElement).value || '';
                            
                            let catCode = 'GEN';
                            const catLower = category.toLowerCase();
                            if (catLower.includes('adapter')) catCode = 'ADC';
                            else if (catLower.includes('cable')) catCode = 'CBL';
                            else if (catLower.includes('mouse')) catCode = 'MSE';
                            else if (catLower.includes('keyboard')) catCode = 'KBD';
                            else if (catLower.includes('router')) catCode = 'RTR';
                            
                            const shortName = name ? name.split(' ')[0].substring(0, 3).toUpperCase() : 'PRD';
                            const random3 = Math.floor(Math.random() * 900) + 100;
                            const sku = `${catCode}-${shortName}-${random3}`;
                            
                            const random12 = Math.floor(Math.random() * 900000000000) + 100000000000;
                            const barcode = random12.toString();
                            
                            (form.querySelector('[name="sku"]') as HTMLInputElement).value = sku;
                            (form.querySelector('[name="barcode"]') as HTMLInputElement).value = barcode;
                          }}
                          className="flex-1 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                          Generate SKU & Barcode
                        </button>
                        <button
                          type="button"
                          onClick={async (e) => {
                            const input = document.getElementById('barcode-input') as HTMLInputElement;
                            const barcode = input.value;
                            if (!barcode) {
                              setError("Please enter a barcode first to fetch data.");
                              return;
                            }
                            try {
                              setLoading(true);
                              setError(null);
                              const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
                              const data = await res.json();
                              if (data.status === 1 && data.product) {
                                const form = (e.currentTarget.closest('form') as HTMLFormElement);
                                const nameInput = form.querySelector('[name="name"]') as HTMLInputElement;
                                const brandInput = form.querySelector('[name="brand"]') as HTMLInputElement;
                                
                                if (data.product.product_name && !nameInput.value) {
                                  nameInput.value = data.product.product_name;
                                }
                                if (data.product.brands && !brandInput.value) {
                                  brandInput.value = data.product.brands.split(',')[0];
                                }
                                setSuccessMessage("Product data fetched successfully!");
                                setTimeout(() => setSuccessMessage(null), 3000);
                              } else {
                                setError("Product not found in online database.");
                              }
                            } catch (err) {
                              setError("Failed to fetch product data online.");
                            } finally {
                              setLoading(false);
                            }
                          }}
                          className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                          Fetch Info from Barcode
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 ml-1">Product Name</label>
                          <input
                            name="name"
                            required
                            defaultValue={editingProduct?.name}
                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white transition-all"
                            placeholder="e.g. Earphones"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 ml-1">Brand</label>
                          <input
                            name="brand"
                            defaultValue={editingProduct?.brand}
                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white transition-all"
                            placeholder="e.g. Sony"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 ml-1">Category</label>
                          <input
                            name="category"
                            required
                            defaultValue={editingProduct?.category}
                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white transition-all"
                            placeholder="e.g. Audio"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section: Pricing & Stock */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-1 bg-emerald-500 rounded-full" />
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Pricing & Inventory</label>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 ml-1">Selling Price (৳)</label>
                        <input
                          name="price"
                          type="number"
                          step="0.01"
                          required
                          defaultValue={editingProduct?.price}
                          className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 ml-1">Cost Price (৳)</label>
                        <input
                          name="cost"
                          type="number"
                          step="0.01"
                          required
                          defaultValue={editingProduct?.cost}
                          className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 ml-1">Current Stock</label>
                        <input
                          name="stock"
                          type="number"
                          required
                          defaultValue={editingProduct?.stock ?? (prefilledBarcode ? 1 : 0)}
                          className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white transition-all font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 ml-1">Min Stock Alert</label>
                        <input
                          name="minStock"
                          type="number"
                          required
                          defaultValue={editingProduct?.minStock}
                          className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section: Details & Media */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-1 bg-amber-500 rounded-full" />
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Details & Media</label>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 ml-1">Image URL</label>
                        <div className="relative">
                          <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                          <input
                            name="imageUrl"
                            type="url"
                            value={imageUrlInput}
                            onChange={(e) => setImageUrlInput(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white transition-all"
                            placeholder="https://..."
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 ml-1">Notes / Issues</label>
                        <textarea
                          name="notes"
                          defaultValue={editingProduct?.notes}
                          rows={2}
                          className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white transition-all resize-none"
                          placeholder="Any specific notes..."
                        />
                      </div>

                      <div className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                        <input
                          type="checkbox"
                          name="isFeatured"
                          id="isFeatured"
                          defaultChecked={editingProduct?.isFeatured}
                          className="w-4 h-4 text-indigo-600 border-slate-300 dark:border-slate-600 rounded focus:ring-indigo-500"
                        />
                        <label htmlFor="isFeatured" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                          Feature on storefront
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </form>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                {editingProduct && (
                  <button
                    type="button"
                    onClick={() => {
                      setPrintingProduct(editingProduct);
                      setIsModalOpen(false);
                    }}
                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2"
                  >
                    <Printer size={14} />
                    <span>Label</span>
                  </button>
                )}
                <button
                  form="product-form"
                  type="submit"
                  disabled={loading}
                  className="flex-[1.5] px-4 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : editingProduct ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Stock Pulse Modal (Unique & Smart History) */}
      <AnimatePresence>
        {historyProduct && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHistoryProduct(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[80]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 right-0 w-full max-w-lg bg-white dark:bg-slate-900 shadow-[-20px_0_50px_rgba(0,0,0,0.1)] z-[90] flex flex-col border-l border-slate-200 dark:border-slate-800"
            >
              {/* Header */}
              <div className="relative p-8 pb-6 overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 dark:opacity-10 pointer-events-none">
                  <History size={120} className="rotate-12" />
                </div>
                
                <div className="flex justify-between items-start relative z-10">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase tracking-[0.2em]">
                      <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                      Product Pulse
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                      {historyProduct.name}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        Imported {historyProduct.createdAt ? format(historyProduct.createdAt.toDate(), 'MMM dd, yyyy') : 'Unknown Date'}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-bold">
                        {historyProduct.category}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setHistoryProduct(null)} 
                    className="p-2.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4 mt-8">
                  <div className="p-4 bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100/50 dark:border-emerald-500/10 rounded-2xl">
                    <p className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wider">Total In</p>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">+{stockInsights.totalAdded}</p>
                  </div>
                  <div className="p-4 bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100/50 dark:border-indigo-500/10 rounded-2xl">
                    <p className="text-[10px] font-bold text-indigo-600/70 dark:text-indigo-400/70 uppercase tracking-wider">Total Out</p>
                    <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">-{stockInsights.totalSold}</p>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-500/70 uppercase tracking-wider">Current</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{historyProduct.stock}</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-8 pb-8">
                {historyProduct.notes && (
                  <div className="mb-8 p-5 bg-amber-50/50 dark:bg-amber-500/5 border border-amber-100/50 dark:border-amber-500/10 rounded-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                      <MessageSquare size={40} />
                    </div>
                    <div className="flex items-center gap-2 mb-3 text-amber-700 dark:text-amber-400">
                      <AlertCircle size={16} />
                      <span className="text-xs font-black uppercase tracking-widest">Active Notes & Issues</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium italic">
                      "{historyProduct.notes}"
                    </p>
                  </div>
                )}

                <div className="space-y-10">
                  {groupedHistory.length === 0 ? (
                    <div className="text-center py-20">
                      <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ClipboardList className="text-slate-300 dark:text-slate-600" size={32} />
                      </div>
                      <p className="text-sm font-bold text-slate-400">No activity recorded yet.</p>
                      <p className="text-xs text-slate-300 dark:text-slate-700 mt-1">Stock movements will appear here.</p>
                    </div>
                  ) : (
                    groupedHistory.map(([date, logs]) => (
                      <div key={date} className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="px-3 py-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black rounded-full uppercase tracking-widest">
                            {format(new Date(date), 'EEEE, MMM dd')}
                          </div>
                          <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                        </div>
                        
                        <div className="space-y-4 pl-2">
                          {logs.map((log, idx) => (
                            <div key={log.id} className="relative flex gap-6 group">
                              {/* Timeline Line */}
                              {idx !== logs.length - 1 && (
                                <div className="absolute left-[19px] top-10 bottom-[-16px] w-0.5 bg-slate-100 dark:bg-slate-800" />
                              )}
                              
                              {/* Icon */}
                              <div className={cn(
                                "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 z-10 shadow-sm transition-transform group-hover:scale-110",
                                log.type === 'addition' ? "bg-emerald-500 text-white" :
                                log.type === 'sale' ? "bg-indigo-600 text-white" :
                                "bg-amber-500 text-white"
                              )}>
                                {log.type === 'addition' ? <ArrowUpRight size={20} /> : 
                                 log.type === 'sale' ? <ArrowDownRight size={20} /> : 
                                 <History size={20} />}
                              </div>

                              {/* Details */}
                              <div className="flex-1 pt-1">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                                      {log.type === 'addition' ? 'Stock Inflow' : log.type === 'sale' ? 'Stock Outflow' : 'Adjustment'}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                      {log.timestamp ? formatAppTime(log.timestamp.toDate(), false) : '--:--'}
                                    </span>
                                  </div>
                                  <div className={cn(
                                    "text-sm font-black",
                                    log.type === 'addition' ? "text-emerald-600" : 
                                    log.type === 'sale' ? "text-indigo-600" : 
                                    "text-amber-600"
                                  )}>
                                    {log.type === 'addition' ? '+' : log.type === 'sale' ? '-' : ''}{log.amount}
                                  </div>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                  {log.note}
                                </p>
                                <div className="mt-2 flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                    <Package size={10} />
                                    Resulting Stock: {log.newStock}
                                  </div>
                                  <button
                                    onClick={() => setLogToDelete({ logId: log.id, productId: historyProduct.id })}
                                    className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                                    title="Delete Log"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Log Delete Confirmation */}
      <AnimatePresence>
        {logToDelete && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trash2 size={40} className="text-red-600" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Delete Stock Log?</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-8">
                  This will remove the log entry. It will NOT revert the stock change.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setLogToDelete(null)}
                    className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteLog(logToDelete.logId, logToDelete.productId)}
                    className="flex-1 px-6 py-4 rounded-2xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Print Barcode Modal & Printable Area */}
      {printingProduct && (
        <>
          {/* UI Modal (Hidden during print) */}
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60] print:hidden">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Print Barcode</h3>
                <button onClick={() => { setPrintingProduct(null); setPrintQuantity(1); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Number of Stickers</label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                      <button 
                        onClick={() => setPrintQuantity(Math.max(1, printQuantity - 1))}
                        className="w-10 h-10 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all"
                      >
                        -
                      </button>
                      <input 
                        type="number" 
                        value={printQuantity}
                        onChange={(e) => setPrintQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 text-center bg-transparent font-bold text-slate-900 dark:text-white outline-none"
                      />
                      <button 
                        onClick={() => setPrintQuantity(printQuantity + 1)}
                        className="w-10 h-10 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-4 text-center">
                    Preview of the thermal sticker.
                  </p>
                  
                  {/* Preview Box */}
                  <div className="bg-white border border-slate-200 shadow-sm p-2 flex flex-col items-center justify-center w-[152px] h-[112px] overflow-hidden">
                    <div className="w-full text-center flex flex-col items-center justify-center">
                      <p className="text-[9px] font-black text-black uppercase tracking-wider m-0 leading-none">{settings?.shopName || 'SMART DIGITAL CARE'}</p>
                      <p className="text-[11px] font-black text-black uppercase truncate w-full m-0 mt-1 leading-tight">{printingProduct.name}</p>
                    </div>
                    <div className="scale-[0.8] origin-top mt-1">
                      <BarcodeGenerator 
                        value={printingProduct.barcode || printingProduct.sku || printingProduct.id.slice(0, 8).toUpperCase()} 
                        format="CODE128"
                        width={1.2} 
                        height={25} 
                        fontSize={12}
                        margin={0}
                        displayValue={true}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 flex gap-3">
                <button
                  onClick={() => { setPrintingProduct(null); setPrintQuantity(1); }}
                  className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!printRef.current) {
                      setError("Print content not found. Please try again.");
                      return;
                    }

                    const printContent = printRef.current.innerHTML;
                    
                    const printWindow = window.open('', '_blank', 'width=600,height=600');
                    if (!printWindow) {
                      setError("Pop-up blocked. Please allow pop-ups to print labels.");
                      return;
                    }

                    printWindow.document.write(`
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <title>Print Labels</title>
                          <style>
                            @page { 
                              size: 38mm 28mm; 
                              margin: 0; 
                            }
                            html, body { 
                              margin: 0; 
                              padding: 0; 
                              width: 38mm; 
                              height: 28mm;
                              background: white;
                            }
                            .print-container { 
                              display: block;
                              width: 38mm;
                            }
                            .label-page {
                              width: 38mm;
                              height: 28mm;
                              display: flex;
                              flex-direction: column;
                              align-items: center;
                              justify-content: center;
                              page-break-after: always;
                              overflow: hidden;
                              box-sizing: border-box;
                              padding: 1.5mm;
                            }
                            /* Force black and white for thermal printers */
                            * {
                              color: black !important;
                              -webkit-print-color-adjust: exact;
                              print-color-adjust: exact;
                            }
                          </style>
                        </head>
                        <body>
                          <div class="print-container">${printContent}</div>
                          <script>
                            window.onload = function() {
                              setTimeout(function() {
                                window.print();
                                window.onafterprint = function() {
                                  window.close();
                                };
                              }, 500);
                            };
                          </script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-2"
                >
                  <Printer size={16} />
                  Print {printQuantity} {printQuantity === 1 ? 'Label' : 'Labels'}
                </button>
              </div>
            </div>
          </div>

          {/* Actual Printable Area (Only visible during print) */}
          <div ref={printRef} className="opacity-0 pointer-events-none absolute -z-50 flex flex-col items-center w-full bg-white">
            {Array.from({ length: printQuantity }).map((_, i) => (
              <div key={i} className="label-page">
                <div className="w-full text-center">
                  <p style={{ fontSize: '7pt', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0', lineHeight: '1' }}>{settings?.shopName || 'SMART DIGITAL CARE'}</p>
                </div>
                <div className="w-full text-center" style={{ margin: '1mm 0' }}>
                  <p style={{ fontSize: '9pt', fontWeight: '900', textTransform: 'uppercase', margin: '0', lineHeight: '1.1', textAlign: 'center' }}>{printingProduct.name}</p>
                </div>
                <div style={{ transform: 'scale(0.8)', transformOrigin: 'top center' }}>
                  <BarcodeGenerator 
                    value={printingProduct.barcode || printingProduct.sku || printingProduct.id.slice(0, 8).toUpperCase()} 
                    format="CODE128"
                    width={1.2} 
                    height={25} 
                    fontSize={12}
                    margin={0}
                    displayValue={true}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="bg-red-100 dark:bg-red-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-red-600 dark:text-red-500">
                <Trash2 size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Delete Product?</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-2">
                  Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-white">{deletingProduct.name}</span>? This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setDeletingProduct(null)}
                  className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 dark:shadow-none disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Bulk Update Modal */}
      <AnimatePresence>
        {bulkUpdateMode && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Bulk Stock Update</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Quickly adjust stock levels for all products.</p>
                  </div>
                </div>
                <button
                  onClick={() => setBulkUpdateMode(false)}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {products.map(product => (
                    <div key={product.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all group">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <Package size={20} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{product.name}</h4>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">{product.category}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current</p>
                          <p className={cn(
                            "text-lg font-black",
                            product.stock <= product.minStock ? "text-amber-500" : "text-slate-900 dark:text-white"
                          )}>{product.stock}</p>
                        </div>
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                          <button
                            onClick={() => handleQuickStockUpdate(product, -1)}
                            className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded-xl transition-all active:scale-90"
                          >
                            <Minus size={18} />
                          </button>
                          <div className="w-10 text-center font-black text-slate-900 dark:text-white">
                            {/* Just a visual separator or we could add an input here */}
                            <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-auto" />
                          </div>
                          <button
                            onClick={() => handleQuickStockUpdate(product, 1)}
                            className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-500 rounded-xl transition-all active:scale-90"
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setBulkUpdateMode(false)}
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Dates Confirmation */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 text-center"
            >
              <div className="w-20 h-20 bg-amber-50 dark:bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-500">
                <AlertTriangle size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Reset All Dates?</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8">
                This will set the "Added Date" of <span className="font-bold text-slate-900 dark:text-white">all {products.length} products</span> to today. This action is permanent and cannot be undone.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={resetAllDates}
                  className="flex-1 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold shadow-lg shadow-amber-200 dark:shadow-none transition-all"
                >
                  Reset All
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Message Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2 font-bold"
          >
            <CheckCircle2 size={20} />
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
