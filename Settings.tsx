import { useState, useMemo, useEffect, useRef } from 'react';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, Timestamp, handleFirestoreError, OperationType, writeBatch } from '../firebase';
import { Product, Sale, Customer, Service, Settings, AppUser } from '../types';
import { StoreSeal } from './StoreSeal';
import { Logo } from './Logo';
import { ShoppingCart, Search, Plus, Minus, Trash2, Package, AlertCircle, CheckCircle2, History, X, Filter, User, UserPlus, Zap, Barcode, Printer, Receipt, AlertTriangle, ChevronDown, Eye, EyeOff, Bookmark, BookmarkPlus, Archive, Play } from 'lucide-react';
import { format } from 'date-fns';
import { cn, formatAppTime, formatAppDateTime } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { CashDrawerBox } from './CashDrawerBox';

interface SalesProps {
  products: Product[];
  sales: Sale[];
  customers: Customer[];
  services: Service[];
  settings: Settings | null;
  appUser: AppUser | null;
}

interface CartItem {
  product: Product;
  quantity: number;
  negotiatedPrice: number | string;
  imeiOrSerial?: string;
  warranty?: string;
}

export default function Sales({ products, sales, customers, services, settings, appUser }: SalesProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'products' | 'services'>('products');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'price-low' | 'price-high' | 'stock-low' | 'stock-high'>('name-asc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrintMessage, setShowPrintMessage] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCostPrice, setShowCostPrice] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [receivedAmount, setReceivedAmount] = useState<number | string>('');
  const [discount, setDiscount] = useState<number | string>(0);
  const [finalTotalInput, setFinalTotalInput] = useState<string>('');
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);
  const [lastAddedItem, setLastAddedItem] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<{
    items: CartItem[];
    total: number;
    received: number;
    change: number;
    customer: Customer | null;
    timestamp: Date;
    discount: number;
    warranty?: string;
    imeiOrSerial?: string;
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const [heldCarts, setHeldCarts] = useState<{ id: string, name: string, items: CartItem[], customer: Customer | null, timestamp: number }[]>(() => {
    try {
      const stored = localStorage.getItem('heldCarts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showHeldCarts, setShowHeldCarts] = useState(false);

  useEffect(() => {
    localStorage.setItem('heldCarts', JSON.stringify(heldCarts));
  }, [heldCarts]);

  // Global Barcode Listener
  useEffect(() => {
    const handleGlobalBarcode = (e: any) => {
      const { barcode } = e.detail;
      if (!barcode) return;
      
      const cleanBarcode = barcode.trim().toLowerCase();
      const product = products.find(p => 
        (p.barcode && p.barcode.trim().toLowerCase() === cleanBarcode) ||
        (p.sku && p.sku.trim().toLowerCase() === cleanBarcode) ||
        (p.id.toLowerCase().includes(cleanBarcode) && cleanBarcode.length >= 5)
      );
      if (product) {
        addToCart(product);
        setSuccessMessage(`Added ${product.name} to cart`);
        setTimeout(() => setSuccessMessage(null), 2000);
        // If mobile cart is closed, open it to show the item was added
        if (window.innerWidth < 768) {
          setIsMobileCartOpen(true);
        }
      } else {
        setError(`Product with barcode "${barcode}" not found`);
        setTimeout(() => setError(null), 3000);
      }
    };

    window.addEventListener('barcodeScanned', handleGlobalBarcode);
    return () => window.removeEventListener('barcodeScanned', handleGlobalBarcode);
  }, [products]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape for closing modals
      if (e.key === 'Escape') {
        if (showHistory) setShowHistory(false);
        if (lastSale) setLastSale(null);
        if (saleToDelete) setSaleToDelete(null);
        if (showHeldCarts) setShowHeldCarts(false);
      }
      // Ctrl/Cmd + S for search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Ctrl/Cmd + P for print
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (lastSale) {
          handlePrint();
        }
      }
      // Ctrl/Cmd + Enter for checkout
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (cart.length > 0 && !loading) {
          handleCheckout();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, loading, discount, showHistory, lastSale, saleToDelete, showHeldCarts]);

  // Focus barcode input on mount
  useEffect(() => {
    if (!showHistory && !lastSale) {
      setTimeout(() => {
        const activeElement = document.activeElement;
        const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
        if (!isInput) {
          barcodeInputRef.current?.focus();
        }
      }, 100);
    }
  }, [showHistory, lastSale]);

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = barcodeInput.trim().toLowerCase();
    if (!cleanInput) return;

    const product = products.find(p => 
      (p.barcode && p.barcode.trim().toLowerCase() === cleanInput) ||
      (p.sku && p.sku.trim().toLowerCase() === cleanInput) ||
      (p.id.toLowerCase().includes(cleanInput) && cleanInput.length >= 5)
    );
    if (product) {
      addToCart(product);
      setBarcodeInput('');
    } else {
      // Maybe show a small error or toast
      setBarcodeInput('');
    }
  };

  // Filter products based on search and category
  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
                           (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase())) ||
                           p.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    return result.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'price-low': return a.price - b.price;
        case 'price-high': return b.price - a.price;
        case 'stock-low': return a.stock - b.stock;
        case 'stock-high': return b.stock - a.stock;
        default: return 0;
      }
    });
  }, [products, searchQuery, sortBy]);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['All', ...Array.from(cats).sort()];
  }, [products]);
  const cartSubtotal = cart.reduce((sum, item) => sum + (Number(item.negotiatedPrice) * item.quantity), 0);
  const cartTotal = Math.max(0, cartSubtotal - Number(discount));
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Sync finalTotalInput with cartTotal
  useEffect(() => {
    if (Number(finalTotalInput) !== cartTotal) {
      setFinalTotalInput(cartTotal.toString());
    }
  }, [cartTotal]);

  const addToCart = (product: Product) => {
    setLastAddedItem(product.name);
    setTimeout(() => setLastAddedItem(null), 2000);
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (product.stock !== undefined && existing.quantity >= product.stock) return prev; // Can't add more than stock
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      if (product.stock !== undefined && product.stock <= 0) return prev;
      return [...prev, { product, quantity: 1, negotiatedPrice: product.price }];
    });
  };

  const addServiceToCart = (service: Service) => {
    // Treat service as a product with infinite stock and 0 cost for POS simplicity
    const serviceAsProduct: Product = {
      id: `svc_${service.id}`,
      name: service.name,
      category: service.category,
      price: service.basePrice,
      cost: 0,
      stock: 999999, // Infinite for POS
      minStock: 0,
      description: service.description,
      isFeatured: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    addToCart(serviceAsProduct);
  };

  const updateNegotiatedPrice = (productId: string, price: number | string) => {
    setCart(prev => prev.map(item => 
      item.product.id === productId ? { ...item, negotiatedPrice: price } : item
    ));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQuantity = item.quantity + delta;
        if (newQuantity > 0 && newQuantity <= item.product.stock) {
          return { ...item, quantity: newQuantity };
        }
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleDeleteSale = async (saleId: string) => {
    try {
      const sale = sales.find(s => s.id === saleId);
      
      if (sale) {
        // 1. Restore the stock if it's a product
        if (!sale.productId.startsWith('svc_')) {
          const product = products.find(p => p.id === sale.productId);
          if (product) {
            await updateDoc(doc(db, 'products', product.id), {
              stock: product.stock + sale.quantity,
              updatedAt: Timestamp.now()
            });

            await addDoc(collection(db, 'products', product.id, 'stockHistory'), {
              type: 'adjustment',
              amount: sale.quantity,
              previousStock: product.stock,
              newStock: product.stock + sale.quantity,
              timestamp: Timestamp.now(),
              note: `Reverted deleted sale of ${sale.quantity} units (Sale ID: ${sale.id.slice(0, 6)})`
            });
          }
        }

        // 2. Revert Customer Loyalty if applicable
        if (sale.customerId) {
          const customer = customers.find(c => c.id === sale.customerId);
          if (customer) {
            const pointsToRevert = Math.floor(sale.totalPrice / 10);
            await updateDoc(doc(db, 'customers', customer.id), {
              totalSpent: Math.max(0, customer.totalSpent - sale.totalPrice),
              loyaltyPoints: Math.max(0, customer.loyaltyPoints - pointsToRevert),
              updatedAt: Timestamp.now()
            });
          }
        }
      }

      await deleteDoc(doc(db, 'sales', saleId));
      setSaleToDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `sales/${saleId}`);
    }
  };

  const handleHoldCart = () => {
    if (cart.length === 0) return;
    const newHold = {
      id: Date.now().toString(),
      name: selectedCustomer ? selectedCustomer.name : `Draft #${heldCarts.length + 1} (${format(new Date(), 'HH:mm')})`,
      items: cart,
      customer: selectedCustomer,
      timestamp: Date.now()
    };
    setHeldCarts([newHold, ...heldCarts]);
    setCart([]);
    setSelectedCustomer(null);
    setReceivedAmount('');
    setDiscount(0);
    setSuccessMessage('Cart saved to drafts!');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleRestoreCart = (draft: { id: string, items: CartItem[], customer: Customer | null }) => {
    setCart(draft.items);
    setSelectedCustomer(draft.customer);
    setHeldCarts(heldCarts.filter(c => c.id !== draft.id));
    setShowHeldCarts(false);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const batch = writeBatch(db);

      // Calculate pro-rated discount for each item if there's a global discount
      const totalBeforeDiscount = cartSubtotal;
      const discountNum = Number(discount);
      
      // Process each item in the cart
      for (const item of cart) {
        const isService = item.product.id.startsWith('svc_');
        const itemSubtotal = Number(item.negotiatedPrice) * item.quantity;
        
        // Distribute discount proportionally
        const itemDiscount = totalBeforeDiscount > 0 
          ? (itemSubtotal / totalBeforeDiscount) * discountNum 
          : 0;
          
        const totalPrice = Math.max(0, itemSubtotal - itemDiscount);
        const totalProfit = (Number(item.negotiatedPrice) - item.product.cost) * item.quantity - itemDiscount;

        // 1. Create sale record with customer info
        const saleRef = doc(collection(db, 'sales'));
        batch.set(saleRef, {
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: Number(item.negotiatedPrice),
          discount: itemDiscount,
          totalPrice,
          totalProfit,
          customerId: selectedCustomer?.id || null,
          customerName: selectedCustomer?.name || null,
          imeiOrSerial: item.imeiOrSerial || null,
          warranty: item.warranty || null,
          timestamp: Timestamp.now(),
          type: isService ? 'service' : 'product'
        });

        // 1.5 Create public sale for social proof (redacted)
        const publicSaleRef = doc(collection(db, 'publicSales'), saleRef.id);
        batch.set(publicSaleRef, {
          productName: item.product.name,
          customerName: selectedCustomer ? selectedCustomer.name : 'Someone',
          timestamp: Timestamp.now()
        });

        // 2. Update product stock (only if not a service)
        if (!isService) {
          const productRef = doc(db, 'products', item.product.id);
          batch.update(productRef, {
            stock: item.product.stock - item.quantity,
            updatedAt: Timestamp.now(),
          });

          // 3. Record in stock history
          const historyRef = doc(collection(db, 'products', item.product.id, 'stockHistory'));
          batch.set(historyRef, {
            type: 'sale',
            amount: item.quantity,
            previousStock: item.product.stock,
            newStock: item.product.stock - item.quantity,
            timestamp: Timestamp.now(),
            note: `Sold ${item.quantity} units at ৳${item.negotiatedPrice}${item.negotiatedPrice !== item.product.price ? ' (Negotiated)' : ''}${selectedCustomer ? ` to ${selectedCustomer.name}` : ''}`
          });
        } else {
          // If it's a service, we might want to create a service order too, 
          // but for POS it's usually a "quick service" that's already done.
          // We'll just record the sale for now.
        }
      }

      // 4. Update customer loyalty if selected
      if (selectedCustomer) {
        const pointsEarned = Math.floor(cartTotal / 10); // 1 point per 10 BDT
        const customerRef = doc(db, 'customers', selectedCustomer.id);
        batch.update(customerRef, {
          totalSpent: selectedCustomer.totalSpent + cartTotal,
          loyaltyPoints: selectedCustomer.loyaltyPoints + pointsEarned,
          lastVisit: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }

      await batch.commit();

      setCart([]);
      setSelectedCustomer(null);
      setDiscount(0);
      
      // Store for receipt
      setLastSale({
        items: cart,
        total: cartTotal,
        received: Number(receivedAmount) || cartTotal,
        change: Math.max(0, (Number(receivedAmount) || cartTotal) - cartTotal),
        customer: selectedCustomer,
        timestamp: new Date(),
        discount: Number(discount)
      });
      
      setReceivedAmount('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      console.error("Checkout error:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setError(errorMsg);
      try {
        handleFirestoreError(error, OperationType.CREATE, 'sales');
      } catch (e) {}
    } finally {
      setLoading(false);
    }
  };

  const [receiptType, setReceiptType] = useState<'a4' | 'pos'>('pos');

  const handlePrint = (customSale?: any) => {
    if (customSale && customSale.nativeEvent) {
      customSale = undefined;
    }
    if (customSale) {
      const isFirestoreSale = customSale.productName !== undefined;
      
      if (isFirestoreSale) {

        setLastSale({
          items: [{
            product: { 
              name: customSale.productName, 
              price: customSale.unitPrice,
              id: customSale.productId
            } as any,
            quantity: customSale.quantity,
            negotiatedPrice: customSale.unitPrice
          }],
          total: customSale.totalPrice,
          received: customSale.totalPrice,
          change: 0,
          customer: customSale.customerName ? { name: customSale.customerName, phone: '' } as any : null,
          warranty: customSale.warranty || '',
          imeiOrSerial: customSale.imeiOrSerial || '',
          timestamp: customSale.timestamp?.toDate ? customSale.timestamp.toDate() : new Date(),
          discount: customSale.discount || 0
        });
      } else {
        setLastSale(customSale);
      }
    }
    setTimeout(() => {
      const receiptElement = document.getElementById('sales-receipt-content');
      if (receiptElement) {
        let printDiv = document.querySelector('.temp-print-container') as HTMLDivElement;
        if (!printDiv) {
          printDiv = document.createElement('div');
          printDiv.className = 'global-print-container temp-print-container';
          document.body.appendChild(printDiv);
        }
        printDiv.innerHTML = receiptElement.outerHTML;
        setTimeout(() => {
          window.print();
          setTimeout(() => {
            if (printDiv) printDiv.innerHTML = '';
          }, 1000);
        }, 100);
      } else {
        window.print(); // Fallback
      }
    }, 100);
  };
  
  return (
    <div className="h-[calc(100vh-12rem)] lg:h-[calc(100vh-7rem)] flex flex-col gap-4 -m-1 p-1 relative overflow-y-auto">
      <CashDrawerBox registerId="sales" registerName="Sales POS Register" />
      <div className="flex flex-col lg:flex-row gap-2 flex-1 min-h-0 relative">
      
      {/* Left Side: Product Grid */}
      <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden relative">
        {/* Success/Error Toast */}
        <AnimatePresence>
          {(successMessage || error) && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 font-bold text-sm"
              style={{ 
                backgroundColor: successMessage ? '#10b981' : '#ef4444',
                color: 'white'
              }}
            >
              {successMessage ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              {successMessage || error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Barcode Listener (Hidden) */}
        <form onSubmit={handleBarcodeSubmit} className="sr-only">
          <input
            ref={barcodeInputRef}
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onBlur={(e) => {
              // Prevent losing focus unless a modal is open or another input is focused
              const relatedTarget = e.relatedTarget as HTMLElement;
              const isInput = relatedTarget?.tagName === 'INPUT' || relatedTarget?.tagName === 'TEXTAREA';
              if (!showHistory && !lastSale && !isInput) {
                setTimeout(() => barcodeInputRef.current?.focus(), 10);
              }
            }}
          />
        </form>

        {/* Search Header */}
        <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-2 bg-slate-50/30 dark:bg-slate-800/20">
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl shrink-0">
              <button
                onClick={() => setViewMode('products')}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all",
                  viewMode === 'products' ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-sm" : "text-slate-500"
                )}
              >
                Stock
              </button>
              <button
                onClick={() => setViewMode('services')}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all",
                  viewMode === 'services' ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-sm" : "text-slate-500"
                )}
              >
                Svcs
              </button>
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={14} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={viewMode === 'products' ? "Search... (⌘S)" : "Search..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500"
                autoFocus
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-full transition-colors"
                  title="Clear search"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          </div>

          {viewMode === 'products' && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap border transition-all",
                    selectedCategory === cat 
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none" 
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-300"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="relative shrink-0">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="appearance-none pl-7 pr-8 py-1.5 text-[10px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-200 font-bold cursor-pointer transition-all"
                >
                  <option value="name-asc">A-Z</option>
                  <option value="name-desc">Z-A</option>
                  <option value="price-low">৳ Low</option>
                  <option value="price-high">৳ High</option>
                  {viewMode === 'products' && (
                    <>
                      <option value="stock-low">Stock ↑</option>
                      <option value="stock-high">Stock ↓</option>
                    </>
                  )}
                </select>
                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
              </div>

              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider rounded-lg border border-emerald-100 dark:border-emerald-500/20">
                <Barcode size={12} />
                <span>Scanner</span>
              </div>
              
              <div className="hidden sm:flex items-center gap-1">
                <button 
                  onClick={() => setShowHeldCarts(true)}
                  className="flex items-center justify-center w-7 h-7 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors border border-blue-200 dark:border-blue-800 relative group"
                  title="View Drafts"
                >
                  <Bookmark size={14} />
                  {heldCarts.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">{heldCarts.length}</span>}
                </button>
                <button 
                  onClick={handleHoldCart}
                  disabled={cart.length === 0}
                  className="flex items-center justify-center w-7 h-7 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors border border-amber-200 dark:border-amber-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Hold Cart (Draft)"
                >
                  <BookmarkPlus size={14} />
                </button>
              </div>

              <button
                onClick={() => setShowCostPrice(!showCostPrice)}
                className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-lg border transition-all",
                  showCostPrice 
                    ? "bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-500/10 dark:border-indigo-500/30 dark:text-indigo-400" 
                    : "bg-white border-slate-200 text-slate-400 hover:text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:hover:text-slate-300"
                )}
                title={showCostPrice ? "Hide Cost Price" : "Show Cost Price"}
              >
                {showCostPrice ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>

            <button 
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all border border-slate-200 dark:border-slate-700"
            >
              <History size={14} />
              <span>History</span>
            </button>
          </div>
        </div>

        {/* Products/Services Grid */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-1.5">
            {viewMode === 'products' ? (
              filteredProducts.map(product => {
                const cartItem = cart.find(item => item.product.id === product.id);
                const remainingStock = product.stock - (cartItem?.quantity || 0);
                const isOutOfStock = remainingStock <= 0;

                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={isOutOfStock}
                    className={cn(
                      "flex flex-col text-left bg-white dark:bg-slate-900 border rounded-2xl p-2 transition-all duration-300 group relative",
                      isOutOfStock 
                        ? "opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-800" 
                        : "border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-100 dark:hover:shadow-none hover:-translate-y-1 cursor-pointer",
                      cartItem && "ring-2 ring-indigo-500 border-transparent dark:border-transparent"
                    )}
                  >
                    <div className="w-full aspect-square rounded-xl bg-slate-50 dark:bg-slate-800 mb-2 overflow-hidden flex items-center justify-center relative">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                      ) : (
                        <Package className="text-slate-300 dark:text-slate-600" size={24} />
                      )}
                      {cartItem && (
                        <div className="absolute top-1.5 right-1.5 bg-indigo-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg animate-in zoom-in duration-300">
                          {cartItem.quantity}
                        </div>
                      )}
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center">
                          <span className="bg-white/90 dark:bg-slate-900/90 px-2 py-1 rounded-lg text-[8px] font-black text-red-600 uppercase tracking-widest">Out of Stock</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 w-full min-w-0">
                      <h4 className="font-black text-slate-900 dark:text-white line-clamp-2 text-[10px] leading-tight mb-1 group-hover:text-indigo-600 transition-colors">{product.name}</h4>
                      <div className="flex items-center gap-1 mb-2">
                        <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">{product.category}</span>
                      </div>
                    </div>
                    <div className="mt-auto flex items-center justify-between w-full">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Price</span>
                        <div className="flex items-center gap-1">
                          <span className="font-black text-xs text-indigo-600 dark:text-indigo-400">৳{product.price}</span>
                          {showCostPrice && (
                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1 rounded">
                              C:৳{product.cost}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={cn(
                        "px-2 py-1 rounded-lg text-[9px] font-black flex flex-col items-center leading-none",
                        remainingStock < 5 ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      )}>
                        <span className="text-[7px] uppercase opacity-60 mb-0.5">Stock</span>
                        {remainingStock}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              services
                .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(service => {
                  const cartItem = cart.find(item => item.product.id === `svc_${service.id}`);
                  return (
                    <button
                      key={service.id}
                      onClick={() => addServiceToCart(service)}
                      className={cn(
                        "flex flex-col text-left bg-white dark:bg-slate-900 border rounded-xl p-1.5 transition-all duration-200 group border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-sm hover:-translate-y-0.5 cursor-pointer",
                        cartItem && "ring-2 ring-indigo-500 border-transparent dark:border-transparent"
                      )}
                    >
                      <div className="w-full aspect-square rounded-lg bg-indigo-50 dark:bg-indigo-900/20 mb-1 overflow-hidden flex items-center justify-center relative text-indigo-600">
                        <Zap size={24} />
                        {cartItem && (
                          <div className="absolute top-1 right-1 bg-indigo-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-md">
                            {cartItem.quantity}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 w-full min-w-0">
                        <h4 className="font-bold text-slate-900 dark:text-white line-clamp-1 text-[10px] mb-0.5">{service.name}</h4>
                        <p className="text-[8px] text-slate-500 dark:text-slate-400 truncate">{service.category}</p>
                      </div>
                      <div className="mt-1 flex items-end justify-between w-full">
                        <span className="font-black text-[11px] text-indigo-600 dark:text-indigo-400">৳{service.basePrice}</span>
                        <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                          Service
                        </span>
                      </div>
                    </button>
                  );
                })
            )}
            {((viewMode === 'products' && filteredProducts.length === 0) || (viewMode === 'services' && services.length === 0)) && (
              <div className="col-span-full py-8 text-center text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                No {viewMode} found.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Side: Cart / POS (Desktop: Sidebar, Mobile: Sheet) */}
      <div className={cn(
        "bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col min-h-0 transition-all duration-300",
        "w-full lg:w-72 xl:w-80 flex-shrink-0",
        isMobileCartOpen 
          ? "fixed inset-0 z-50 lg:inset-auto lg:z-0 rounded-none lg:rounded-xl" 
          : "hidden lg:flex"
      )}>
        {/* Mobile Cart Header */}
        <div className="lg:hidden p-4 bg-indigo-600 text-white flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileCartOpen(false)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
              <ChevronDown size={24} />
            </button>
            <div>
              <h3 className="font-black uppercase tracking-wider text-sm">Your Order</h3>
              <p className="text-[10px] opacity-80 font-bold">{cartItemsCount} items selected</p>
            </div>
          </div>
          <button 
            onClick={() => {
              if (window.confirm('Clear all items from cart?')) {
                setCart([]);
                setIsMobileCartOpen(false);
              }
            }}
            className="p-2 hover:bg-red-500/20 rounded-xl transition-colors text-white/80 hover:text-white"
          >
            <Trash2 size={20} />
          </button>
        </div>

        <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between lg:flex hidden">
          <h3 className="font-black text-[10px] text-slate-900 dark:text-white uppercase tracking-[0.2em] flex items-center gap-2">
            <ShoppingCart className="text-indigo-600 dark:text-indigo-400" size={14} />
            Current Order
          </h3>
          <button 
            onClick={() => setCart([])}
            className="text-[9px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest transition-colors"
          >
            Clear
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
          {/* Customer Selector */}
          <div className="mb-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Customer</span>
              {selectedCustomer && (
                <button 
                  onClick={() => setSelectedCustomer(null)}
                  className="text-[9px] font-bold text-red-500 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            {selectedCustomer ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600">
                  <User size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-slate-900 dark:text-white truncate">{selectedCustomer.name}</p>
                  <p className="text-[8px] text-slate-500 dark:text-slate-400">{selectedCustomer.loyaltyPoints} Points</p>
                </div>
              </div>
            ) : (
              <select
                onChange={(e) => {
                  const customer = customers.find(c => c.id === e.target.value);
                  if (customer) setSelectedCustomer(customer);
                }}
                className="w-full bg-white dark:bg-slate-900 border-none rounded-lg py-1.5 px-2 text-[10px] font-bold outline-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-indigo-500"
                value=""
              >
                <option value="" disabled>Select Customer...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                ))}
              </select>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-2 opacity-60">
              <ShoppingCart size={24} strokeWidth={1.5} />
              <p className="font-medium text-xs">Empty</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="flex gap-1.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-1 rounded-lg shadow-sm animate-in fade-in slide-in-from-right-4 duration-200">
                <div className="w-8 h-8 rounded-md bg-slate-50 dark:bg-slate-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {item.product.imageUrl ? (
                    <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Package className="text-slate-300 dark:text-slate-600" size={14} />
                  )}
                </div>
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-slate-900 dark:text-white text-[10px] line-clamp-1 pr-1">{item.product.name}</h4>
                    <button onClick={() => removeFromCart(item.product.id)} className="text-slate-300 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold">৳</span>
                      <input 
                        type="number" 
                        value={item.negotiatedPrice}
                        onChange={(e) => updateNegotiatedPrice(item.product.id, e.target.value)}
                        className={cn(
                          "w-20 bg-slate-50 dark:bg-slate-800/50 rounded px-1 py-0.5 text-[10px] font-black focus:ring-1 focus:ring-indigo-500 outline-none transition-all",
                          Number(item.negotiatedPrice) !== item.product.price 
                            ? "text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800" 
                            : "text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700"
                        )}
                        title="Negotiated Price"
                      />
                      {Number(item.negotiatedPrice) !== item.product.price && (
                        <span className="text-[7px] font-bold text-amber-500 animate-pulse">!</span>
                      )}
                      {showCostPrice && (
                        <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 ml-1">
                          (C:৳{item.product.cost})
                        </span>
                      )}
                    </div>
                  <div className="flex items-center justify-between mt-1 gap-2">
                    <div className="flex-1 space-y-1">
                      <input 
                        type="text" 
                        placeholder="IMEI/Serial"
                        value={item.imeiOrSerial || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCart(prev => prev.map(c => c.product.id === item.product.id ? { ...c, imeiOrSerial: val } : c));
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-800/50 rounded px-1.5 py-0.5 text-[8px] font-bold border border-slate-100 dark:border-slate-700 focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                      <input 
                        type="text" 
                        placeholder="Warranty (e.g. 1 Year)"
                        value={item.warranty || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCart(prev => prev.map(c => c.product.id === item.product.id ? { ...c, warranty: val } : c));
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-800/50 rounded px-1.5 py-0.5 text-[8px] font-bold border border-slate-100 dark:border-slate-700 focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 rounded-md p-0.5 border border-slate-100 dark:border-slate-700 shrink-0">
                      <button 
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="w-4 h-4 flex items-center justify-center bg-white dark:bg-slate-700 rounded shadow-sm text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-50"
                        disabled={item.quantity <= 1}
                      >
                        <Minus size={10} />
                      </button>
                      <span className="text-[9px] font-bold w-3 text-center dark:text-white">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="w-4 h-4 flex items-center justify-center bg-white dark:bg-slate-700 rounded shadow-sm text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-50"
                        disabled={item.quantity >= item.product.stock}
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        </div>

        {/* Checkout Section */}
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
              <span>Subtotal</span>
              <span>৳{cartSubtotal.toFixed(2)}</span>
            </div>
            
            <div className="flex items-center justify-between gap-2 py-0.5">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Discount</span>
              <div className="relative flex-1 max-w-[100px]">
                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">৳</span>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-4 pr-1.5 py-1 text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md outline-none focus:ring-1 focus:ring-indigo-500 text-right"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 py-0.5">
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">Final Total</span>
              <div className="relative flex-1 max-w-[100px]">
                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-indigo-400 font-bold">৳</span>
                <input
                  type="number"
                  value={finalTotalInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFinalTotalInput(val);
                    if (val === '') {
                      setDiscount(0);
                    } else {
                      const newTotal = Number(val);
                      setDiscount(Math.max(0, cartSubtotal - newTotal));
                    }
                  }}
                  placeholder={cartTotal.toFixed(2)}
                  className="w-full pl-4 pr-1.5 py-1 text-[10px] font-black bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-md outline-none focus:ring-1 focus:ring-indigo-500 text-right text-indigo-600 dark:text-indigo-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 py-1">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Received</span>
              <div className="flex flex-col items-end gap-1.5 flex-1 max-w-[140px]">
                <div className="relative w-full">
                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">৳</span>
                  <input
                    type="number"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    placeholder={cartTotal.toString()}
                    className="w-full pl-4 pr-1.5 py-1.5 text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md outline-none focus:ring-1 focus:ring-indigo-500 text-right"
                  />
                </div>
                <div className="flex gap-1 overflow-x-auto no-scrollbar w-full justify-end">
                  <button
                    onClick={() => setReceivedAmount(cartTotal.toString())}
                    className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[8px] font-black rounded hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors"
                  >
                    Exact
                  </button>
                  {[50, 100, 500, 1000].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setReceivedAmount(amt.toString())}
                      className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-[8px] font-black rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                    >
                      +{amt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {Number(receivedAmount) > cartTotal && (
              <div className="flex justify-between text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                <span>Change</span>
                <span>৳{(Number(receivedAmount) - cartTotal).toFixed(2)}</span>
              </div>
            )}
            <div className="pt-1 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <span className="font-bold text-[11px] text-slate-900 dark:text-white">To Pay</span>
              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">৳{cartTotal.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || loading}
            className="w-full py-2 bg-indigo-600 text-white text-[11px] font-bold rounded-lg hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 active:scale-[0.98] group"
          >
            {loading ? '...' : `Pay ৳${cartTotal.toFixed(2)}`}
            {!loading && cart.length > 0 && (
              <div className="hidden sm:flex items-center gap-0.5 ml-1 opacity-60 group-hover:opacity-100 transition-opacity">
                <kbd className="bg-indigo-800/50 px-1 py-0.5 rounded text-[7px] font-bold font-sans">⌘</kbd>
                <kbd className="bg-indigo-800/50 px-1 py-0.5 rounded text-[7px] font-bold font-sans">↵</kbd>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Floating Cart Button */}
      {!isMobileCartOpen && cart.length > 0 && (
        <div className="lg:hidden fixed bottom-20 right-4 z-40 flex flex-col items-end gap-3">
          <AnimatePresence>
            {lastAddedItem && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2"
              >
                <CheckCircle2 size={14} />
                Added {lastAddedItem}
              </motion.div>
            )}
          </AnimatePresence>
          
          <button
            onClick={() => setIsMobileCartOpen(true)}
            className="bg-indigo-600 text-white p-4 rounded-2xl shadow-2xl shadow-indigo-200 dark:shadow-none flex items-center gap-3 animate-in zoom-in duration-300 active:scale-95"
          >
            <div className="relative">
              <ShoppingCart size={24} />
              <span className="absolute -top-2 -right-2 bg-white text-indigo-600 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                {cartItemsCount}
              </span>
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest leading-none mb-1">View Cart</p>
              <p className="text-sm font-black leading-none">৳{cartTotal.toFixed(2)}</p>
            </div>
          </button>
        </div>
      )}

      {/* Held Carts (Drafts) Modal */}
      {showHeldCarts && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bookmark size={20} className="text-indigo-600 dark:text-indigo-400" />
                Parked Sales
              </h3>
              <button onClick={() => setShowHeldCarts(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 bg-white dark:bg-slate-800 rounded-full p-1 shadow-sm">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3">
                {heldCarts.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 dark:text-slate-400 flex flex-col items-center">
                    <Archive size={32} className="opacity-20 mb-3" />
                    No parked sales.
                  </div>
                ) : (
                  heldCarts.map((draft) => (
                    <div key={draft.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex items-center gap-4 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 dark:text-white truncate">{draft.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{draft.items.length} items</span>
                          <span className="text-[10px] text-slate-400">{(() => { 
                            if (!draft.timestamp) return 'Unknown';
                            try {
                              const d = new Date(draft.timestamp);
                              return isNaN(d.getTime()) ? 'Unknown' : format(d, 'MMM d, p');
                            } catch(e) { return 'Unknown'; }
                          })()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleRestoreCart(draft)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                        >
                          <Play size={14} className="fill-current" />
                          Resume
                        </button>
                        <button
                          onClick={() => setHeldCarts(heldCarts.filter(c => c.id !== draft.id))}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete draft"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History size={20} className="text-indigo-600 dark:text-indigo-400" />
                Recent Transactions
              </h3>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 bg-white dark:bg-slate-800 rounded-full p-1 shadow-sm">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {sales.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 dark:text-slate-400">No sales recorded yet.</div>
                ) : (
                  sales.map((sale) => {
                    const product = products.find(p => p.id === sale.productId);
                    return (
                      <div key={sale.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center overflow-hidden">
                            {product?.imageUrl ? (
                              <img src={product.imageUrl} alt={sale.productName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Package size={20} className="text-indigo-600 dark:text-indigo-400" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 dark:text-white">{sale.productName}</h4>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {sale.timestamp ? formatAppDateTime(typeof sale.timestamp.toDate === 'function' ? sale.timestamp.toDate() : new Date(sale.timestamp as any)) : 'Unknown time'}
                              </p>
                              {sale.unitPrice !== product?.price && (
                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 rounded">
                                  Negotiated: ৳{sale.unitPrice}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePrint(sale)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all"
                            title="Print Memo"
                          >
                            <Printer size={18} />
                          </button>
                          <button
                            onClick={() => setSaleToDelete(sale.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                            title="Delete Sale Record"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                          <div className="text-right">
                            <p className="font-black text-slate-900 dark:text-white">৳{(sale.totalPrice || 0).toFixed(2)}</p>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{sale.quantity} units</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {saleToDelete && (
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
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Delete Sale Record?</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-8">
                  This action cannot be undone. This will permanently remove the sale record from your history.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setSaleToDelete(null)}
                    className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteSale(saleToDelete)}
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

      {/* Notifications */}
      {error && (
        <div className="fixed bottom-4 right-4 max-w-sm bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex items-start gap-3 z-[100] animate-in slide-in-from-bottom-4 duration-300">
          <AlertCircle className="flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-sm font-bold">Checkout Failed</p>
            <p className="text-xs opacity-90 mt-1">{error}</p>
            <button onClick={() => setError(null)} className="mt-2 text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-1 rounded hover:bg-white/30">Dismiss</button>
          </div>
        </div>
      )}

      {/* Cash Memo / Receipt Modal */}
      <AnimatePresence>
        {lastSale && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={cn(
                "bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col transition-all duration-300",
                receiptType === 'a4' ? "w-full max-w-4xl h-[90vh]" : "w-full max-w-sm max-h-[80vh]"
              )}
            >
              {/* Receipt Controls */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 print:hidden">
                <div className="flex items-center gap-2">
                  <div className="flex bg-slate-200/50 dark:bg-slate-900 p-1 rounded-xl">
                    <button
                      onClick={() => setReceiptType('pos')}
                      className={cn(
                        "px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all",
                        receiptType === 'pos' ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-sm" : "text-slate-500"
                      )}
                    >
                      POS (80mm)
                    </button>
                    <button
                      onClick={() => setReceiptType('a4')}
                      className={cn(
                        "px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all",
                        receiptType === 'a4' ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-sm" : "text-slate-500"
                      )}
                    >
                      A4 Invoice
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrint()}
                    className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg flex items-center gap-2"
                    title="Print Memo/Invoice"
                  >
                    <Printer size={18} />
                    <span>Print Invoice</span>
                  </button>
                  <button onClick={() => setLastSale(null)} className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 hover:text-slate-700 transition-colors">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 dark:bg-slate-950/50 flex justify-center">
                <div id="sales-receipt-content" className={cn(
                  "bg-white text-black font-sans shadow-sm",
                  receiptType === 'a4' ? "w-[210mm] min-h-[260mm] p-[15mm] flex flex-col" : "w-[80mm] p-4 text-[10px]"
                )}>
                  <style>{`
                    @media print {
                      @page { size: ${receiptType === 'a4' ? 'A4' : '80mm 200mm'}; margin: 0; }
                      body { background: white !important; margin: 0 !important; padding: 0 !important; }
                      body * { visibility: hidden; }
                      #sales-receipt-content, #sales-receipt-content * { visibility: visible; }
                      #sales-receipt-content { 
                        position: absolute; 
                        left: 0; 
                        top: 0; 
                        width: ${receiptType === 'a4' ? '100%' : '80mm'}; 
                        box-shadow: none !important; 
                        background: white !important;
                        color: black !important;
                      }
                      .dark { color-scheme: light; }
                    }
                    .retail-blue { color: #1e3a8a; }
                    .retail-bg-blue { background-color: #1e3a8a; }
                  `}</style>
                  
                  {/* Header */}
                  <div className={cn("flex justify-between items-start mb-4", receiptType === 'pos' && "flex-col items-center text-center")}>
                    <div className={cn("flex items-center gap-3", receiptType === 'pos' && "flex-col mb-4")}>
                      {settings?.shopLogo ? (
                        <div className={cn("flex items-center justify-center shrink-0", receiptType === 'a4' ? "h-14 w-auto" : "h-16 w-auto")}>
                          <img src={settings.shopLogo} alt="Shop Logo" className="h-full w-auto object-contain" />
                        </div>
                      ) : (
                        <div className={cn("bg-white text-[#1e3a8a] border-4 border-[#1e3a8a] flex items-center justify-center p-2 rounded-xl shrink-0", receiptType === 'a4' ? "w-16 h-16" : "w-16 h-16")}>
                          <Logo className={receiptType === 'a4' ? "w-10 h-10" : "w-10 h-10"} />
                        </div>
                      )}
                      <div className={cn(receiptType === 'pos' ? "text-center" : "text-left", settings?.shopLogo && "hidden")}>
                        <h1 className={cn("font-black tracking-tight leading-none text-[#1e3a8a]", receiptType === 'a4' ? "text-2xl uppercase" : "text-xl uppercase")}>{settings?.shopName || 'Smart Digital Care'}</h1>
                        <p className={cn("font-bold text-slate-500 tracking-tighter uppercase mb-2", receiptType === 'a4' ? "text-[10px]" : "text-[8px]")}>
                          Quality Products • Trusted Service • Satisfaction
                        </p>
                      </div>
                      <div className={cn("space-y-0.5 text-slate-600 font-medium", receiptType === 'a4' ? "text-[10px]" : "text-[9px]", settings?.shopLogo && receiptType === 'a4' && "ml-3 pl-3 border-l-[1.5px] border-slate-200")}>
                        <p>{settings?.shopAddress || 'Cantonment Masjid Market, Cantonment, Cumilla'}</p>
                        <p>For any support WhatsApp: +8801766407313</p>
                        <p>For mobile repair whatsapp: +8801854648690</p>
                        <p>Facebook: facebook.com/sdc.cantonment</p>
                      </div>
                    </div>
                    
                    <div className={cn("text-right", receiptType === 'pos' ? "w-full border-t border-slate-100 pt-4 mt-2" : "")}>
                      <div className={cn("inline-block retail-bg-blue text-white font-black px-4 py-2 uppercase tracking-widest mb-4", receiptType === 'a4' ? "text-xl" : "text-sm w-full text-center")}>
                        {receiptType === 'a4' ? 'Invoice/Memo' : 'Cash Memo'}
                      </div>
                      <div className={cn("space-y-1 text-slate-700", receiptType === 'a4' ? "text-sm" : "text-[10px]")}>
                        <p className="flex justify-between gap-4"><span className="font-bold uppercase text-slate-400">Inv No:</span> <span>#SDC-{lastSale.timestamp ? format(lastSale.timestamp, 'yyyyMMddHHss') : 'NA'}</span></p>
                        <p className="flex justify-between gap-4"><span className="font-bold uppercase text-slate-400">Date:</span> <span>{lastSale.timestamp ? format(lastSale.timestamp, 'dd MMM, yyyy') : 'NA'}</span></p>
                        <p className="flex justify-between gap-4"><span className="font-bold uppercase text-slate-400">Time:</span> <span>{lastSale.timestamp ? format(lastSale.timestamp, 'hh:mm a') : 'NA'}</span></p>
                        <p className="flex justify-between gap-4"><span className="font-bold uppercase text-slate-400">Salesman:</span> <span>{appUser?.displayName || 'Admin'}</span></p>
                      </div>
                    </div>
                  </div>

                  {/* Customer Section */}
                  <div className={cn("grid grid-cols-2 gap-8 mb-8 border-y-2 border-slate-100 py-4", receiptType === 'pos' && "flex flex-col gap-2 py-2 mb-4")}>
                    <div className={receiptType === 'pos' ? "text-center" : "text-left"}>
                      <h3 className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Bill To:</h3>
                      <p className="font-black text-slate-900 uppercase">{lastSale.customer?.name || 'Cash Customer'}</p>
                      <p className="text-slate-500 font-bold">{lastSale.customer?.phone || 'N/A'}</p>
                    </div>
                    {receiptType === 'a4' && (
                      <div className="text-right">
                        <h3 className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Payment Method:</h3>
                        <p className="font-black text-slate-900 uppercase">Cash / MFS</p>
                        <p className="text-emerald-600 font-bold">PAID FULL</p>
                      </div>
                    )}
                  </div>

                  {/* Table */}
                  <div className="mb-8 overflow-hidden rounded-t-xl border-x border-slate-100">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="retail-bg-blue text-white text-[10px] font-black uppercase tracking-wider">
                          <th className="p-3 text-center w-8">SL</th>
                          <th className="p-3">Product Name / Info</th>
                          <th className={cn("p-3 text-center", receiptType === 'pos' && "hidden")}>Warranty</th>
                          <th className="p-3 text-center">Qty</th>
                          <th className="p-3 text-right">Price</th>
                          <th className="p-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className={cn("divide-y divide-slate-100", receiptType === 'a4' ? "text-sm" : "text-[10px]")}>
                        {lastSale.items.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                            <td className="p-3">
                              <p className="font-black text-slate-900 leading-tight">{item.product.name}</p>
                              {(item.imeiOrSerial || item.product.sku) && (
                                <p className="text-[9px] text-slate-500 font-bold mt-1">
                                  IMEI/SN: <span className="text-slate-900 uppercase font-black">{item.imeiOrSerial || item.product.sku}</span>
                                </p>
                              )}
                              {receiptType === 'pos' && item.warranty && (
                                <p className="text-[9px] text-[#1e3a8a] font-bold mt-0.5 whitespace-nowrap">
                                  Waranty: {item.warranty}
                                </p>
                              )}
                            </td>
                            <td className={cn("p-3 text-center text-[#1e3a8a] font-black", receiptType === 'pos' && "hidden")}>
                              {item.warranty || 'No Warranty'}
                            </td>
                            <td className="p-3 text-center font-bold">{item.quantity}</td>
                            <td className="p-3 text-right font-medium">৳{Number(item.negotiatedPrice).toFixed(0)}</td>
                            <td className="p-3 text-right font-black">৳{(item.quantity * Number(item.negotiatedPrice)).toFixed(0)}</td>
                          </tr>
                        ))}
                        {/* Filler rows for A4 to keep footer at bottom or just for aesthetic */}
                        {receiptType === 'a4' && lastSale.items.length < 5 && Array.from({ length: 5 - lastSale.items.length }).map((_, i) => (
                          <tr key={`filler-${i}`} className="h-12">
                            <td className="p-3"></td>
                            <td className="p-3"></td>
                            <td className="p-3"></td>
                            <td className="p-3"></td>
                            <td className="p-3"></td>
                            <td className="p-3"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary */}
                  <div className="flex flex-wrap justify-between items-start gap-4 mt-2">
                    <div className={cn("flex-1 min-w-[200px]", receiptType === 'pos' && "hidden")}>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-start gap-4">
                        <div className="flex-1">
                          <h4 className="text-[9px] font-black uppercase text-slate-400 mb-1.5 tracking-widest flex items-center gap-1.5">
                            <CheckCircle2 size={10} className="text-emerald-600" />
                            Terms & Warranty
                          </h4>
                          <ul className="text-[8px] text-slate-600 font-bold space-y-0.5 list-disc pl-3">
                            <li>Warranty valid only with original invoice. No refund/exchange after delivery.</li>
                            <li>No warranty for physical/water damage, or burnt components.</li>
                            <li>Company warranty products handled by authorized service centers.</li>
                          </ul>
                        </div>
                        {settings?.bkashQrImage && (
                          <div className="w-20 h-20 bg-white rounded-lg flex flex-col items-center justify-center p-1.5 border border-slate-200 shrink-0">
                            <img src={settings.bkashQrImage} alt="bKash QR" className="w-full h-full object-contain mix-blend-multiply" />
                            <p className="text-[6px] font-black text-[#e2136e] uppercase tracking-tighter w-full text-center mt-0.5">bKash Pay</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className={cn(receiptType === 'a4' ? "w-64" : "w-full")}>
                      <div className="space-y-1.5 text-slate-700">
                        <div className="flex justify-between text-xs sm:text-sm font-medium">
                          <span className="text-slate-400 uppercase font-black text-[10px]">Subtotal:</span>
                          <span className="font-bold">৳{(lastSale.total + lastSale.discount).toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between text-xs sm:text-sm font-medium">
                          <span className="text-slate-400 uppercase font-black text-[10px]">Discount:</span>
                          <span className="font-bold text-red-500">-৳{Number(lastSale.discount).toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between text-xs sm:text-sm font-medium">
                          <span className="text-slate-400 uppercase font-black text-[10px]">VAT / TAX:</span>
                          <span className="font-bold">৳0.00</span>
                        </div>
                        <div className="flex justify-between text-xs sm:text-sm font-medium">
                          <span className="text-slate-400 uppercase font-black text-[10px]">Service Charge:</span>
                          <span className="font-bold">৳0.00</span>
                        </div>
                        <div className="pt-2 border-t-2 border-slate-100 flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                          <span className="retail-blue font-black uppercase tracking-widest text-xs">Grand Total:</span>
                          <span className="text-xl font-black retail-blue">৳{lastSale.total.toFixed(0)}/-</span>
                        </div>
                        <div className="flex justify-between text-xs font-medium pt-2">
                          <span className="text-slate-400 uppercase font-black text-[10px]">Paid Amount:</span>
                          <span className="font-black text-slate-900 underline underline-offset-4">৳{lastSale.received.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-400 uppercase font-black text-[10px]">Due Amount:</span>
                          <span className="font-black text-red-600">৳{Math.max(0, lastSale.total - lastSale.received).toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* POS Specific Terms and Signatures */}
                  {receiptType === 'pos' && (
                    <div className="mt-6 space-y-4">
                       <div className="text-[8px] text-slate-500 font-bold border-t border-dashed border-slate-200 pt-3 text-center uppercase tracking-widest leading-loose">
                         <p>Warranty ONLY with original invoice</p>
                         <p>No refund or exchange after delivery</p>
                       </div>
                       <div className="flex justify-between pt-6">
                        <div className="text-center">
                          <div className="w-16 border-t border-slate-300 pt-1 mx-auto"></div>
                          <p className="text-[7px] text-slate-400 font-black uppercase">Customer</p>
                        </div>
                        <div className="text-center">
                           <div className="w-16 border-t border-slate-300 pt-1 mx-auto"></div>
                           <p className="text-[7px] text-slate-400 font-black uppercase">Authorized</p>
                        </div>
                       </div>
                       <div className="text-center pt-2">
                         <p className="text-[9px] font-black text-slate-900 uppercase">*** Thank You ***</p>
                       </div>
                    </div>
                  )}

                  {/* A4 Footer with Signatures and Seal */}
                  {receiptType === 'a4' && (
                    <div className="mt-auto pt-4">
                      <div className="flex justify-between items-end">
                        <div className="text-center">
                          <div className="w-24 border-t border-[#1e3a8a] pt-1.5">
                            <p className="font-black tracking-widest text-[#1e3a8a] text-[8px] uppercase">Customer Signature</p>
                          </div>
                        </div>
                        <div className="text-center flex flex-col items-center">
                          <div className="w-28 h-28 flex items-center justify-center relative mix-blend-multiply opacity-90">
                             <StoreSeal />
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="w-24 border-t border-[#1e3a8a] pt-1.5">
                            <p className="font-black tracking-widest text-[#1e3a8a] text-[8px] uppercase">Authorized Signature</p>
                            <p className="text-[6px] text-slate-400 mt-0.5 uppercase font-bold tracking-widest">{settings?.shopName || 'Smart Digital Care'}</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Thank You Message */}
                      <div className="mt-2 border-t border-slate-200 pt-2 text-center flex flex-col items-center">
                        <p className="font-black text-[#1e3a8a] text-[10px] uppercase tracking-widest">{settings?.memoFooter || 'THANK YOU FOR YOUR BUSINESS!'}</p>
                        <p className="text-[7px] text-slate-500 font-bold mt-0.5 tracking-wider">Please come again. It was a pleasure serving you.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {success && (
        <div className="fixed bottom-4 right-4 max-w-sm bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 z-[100] animate-in slide-in-from-bottom-4 duration-300">
          <CheckCircle2 className="flex-shrink-0" size={24} />
          <div>
            <p className="text-sm font-bold">Payment Successful!</p>
            <p className="text-xs opacity-90">Inventory has been updated.</p>
          </div>
        </div>
      )}
      {/* Print Message Toast */}
      <AnimatePresence>
        {showPrintMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2 font-bold"
          >
            <Printer size={20} className="animate-pulse" />
            Preparing for printing...
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </div>
  );
}
