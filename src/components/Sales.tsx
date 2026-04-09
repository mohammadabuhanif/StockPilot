import { useState, useMemo, useEffect, useRef } from 'react';
import { db, collection, addDoc, updateDoc, doc, Timestamp, handleFirestoreError, OperationType } from '../firebase';
import { Product, Sale, Customer, Service } from '../types';
import { ShoppingCart, Search, Plus, Minus, Trash2, Package, AlertCircle, CheckCircle2, History, X, Filter, User, UserPlus, Zap, Barcode, Printer, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface SalesProps {
  products: Product[];
  sales: Sale[];
  customers: Customer[];
  services: Service[];
}

interface CartItem {
  product: Product;
  quantity: number;
  negotiatedPrice: number;
}

export default function Sales({ products, sales, customers, services }: SalesProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'products' | 'services'>('products');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'price-low' | 'price-high' | 'stock-low' | 'stock-high'>('name-asc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [receivedAmount, setReceivedAmount] = useState<number | string>('');
  const [lastSale, setLastSale] = useState<{
    items: CartItem[];
    total: number;
    received: number;
    change: number;
    customer: Customer | null;
    timestamp: Date;
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S for search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        searchInputRef.current?.focus();
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
  }, [cart, loading]);

  // Focus barcode input on mount and periodically to ensure it's always ready
  useEffect(() => {
    const focusInterval = setInterval(() => {
      if (!showHistory && !lastSale) {
        barcodeInputRef.current?.focus();
      }
    }, 2000);
    return () => clearInterval(focusInterval);
  }, [showHistory, lastSale]);

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const product = products.find(p => p.barcode?.toLowerCase() === barcodeInput.toLowerCase());
    if (product) {
      addToCart(product);
      setBarcodeInput('');
    } else {
      // Maybe show a small error or toast
      setBarcodeInput('');
    }
  };

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    let result = products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

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

  const cartTotal = cart.reduce((sum, item) => sum + (item.negotiatedPrice * item.quantity), 0);
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = (product: Product) => {
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

  const updateNegotiatedPrice = (productId: string, price: number) => {
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

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Process each item in the cart
      for (const item of cart) {
        const isService = item.product.id.startsWith('svc_');
        const totalPrice = item.negotiatedPrice * item.quantity;
        const totalProfit = (item.negotiatedPrice - item.product.cost) * item.quantity;

        // 1. Create sale record
        await addDoc(collection(db, 'sales'), {
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.negotiatedPrice,
          totalPrice,
          totalProfit,
          timestamp: Timestamp.now(),
          type: isService ? 'service' : 'product'
        });

        // 2. Update product stock (only if not a service)
        if (!isService) {
          await updateDoc(doc(db, 'products', item.product.id), {
            stock: item.product.stock - item.quantity,
            updatedAt: Timestamp.now(),
          });

          // 3. Record in stock history
          await addDoc(collection(db, 'products', item.product.id, 'stockHistory'), {
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
        await updateDoc(doc(db, 'customers', selectedCustomer.id), {
          totalSpent: selectedCustomer.totalSpent + cartTotal,
          loyaltyPoints: selectedCustomer.loyaltyPoints + pointsEarned,
          lastVisit: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }

      setCart([]);
      setSelectedCustomer(null);
      
      // Store for receipt
      setLastSale({
        items: cart,
        total: cartTotal,
        received: Number(receivedAmount) || cartTotal,
        change: (Number(receivedAmount) || cartTotal) - cartTotal,
        customer: selectedCustomer,
        timestamp: new Date()
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

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col lg:flex-row gap-2 -m-1 p-1 relative">
      
      {/* Left Side: Product Grid */}
      <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Barcode Listener (Hidden) */}
        <form onSubmit={handleBarcodeSubmit} className="sr-only">
          <input
            ref={barcodeInputRef}
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onBlur={(e) => {
              // Prevent losing focus unless a modal is open
              if (!showHistory && !lastSale) {
                setTimeout(() => e.target.focus(), 10);
              }
            }}
          />
        </form>

        {/* Search Header */}
        <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
              <button
                onClick={() => setViewMode('products')}
                className={cn(
                  "px-3 py-1 text-[10px] font-bold rounded-lg transition-all",
                  viewMode === 'products' ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-sm" : "text-slate-500"
                )}
              >
                Products
              </button>
              <button
                onClick={() => setViewMode('services')}
                className={cn(
                  "px-3 py-1 text-[10px] font-bold rounded-lg transition-all",
                  viewMode === 'services' ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-sm" : "text-slate-500"
                )}
              >
                Services
              </button>
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={14} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={viewMode === 'products' ? "Search products... (⌘S)" : "Search services..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1 text-xs bg-slate-50 dark:bg-slate-800/50 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500"
                autoFocus
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="relative shrink-0">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="appearance-none pl-7 pr-6 py-1 text-[10px] bg-slate-50 dark:bg-slate-800/50 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-200 font-bold cursor-pointer transition-all"
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
                <Filter className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
              </div>

              <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-lg border border-indigo-100 dark:border-indigo-500/20">
                <Barcode size={12} />
                <span>Scanner Active</span>
              </div>
            </div>

            <button 
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-1 px-2 py-1 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold rounded-lg transition-colors border border-slate-100 dark:border-slate-700"
            >
              <History size={14} />
              <span className="hidden sm:inline">History</span>
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
                      "flex flex-col text-left bg-white dark:bg-slate-900 border rounded-xl p-1.5 transition-all duration-200 group",
                      isOutOfStock 
                        ? "opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-800" 
                        : "border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-sm hover:-translate-y-0.5 cursor-pointer",
                      cartItem && "ring-2 ring-indigo-500 border-transparent dark:border-transparent"
                    )}
                  >
                    <div className="w-full aspect-square rounded-lg bg-slate-50 dark:bg-slate-800 mb-1 overflow-hidden flex items-center justify-center relative">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Package className="text-slate-300 dark:text-slate-600" size={20} />
                      )}
                      {cartItem && (
                        <div className="absolute top-1 right-1 bg-indigo-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-md">
                          {cartItem.quantity}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 w-full min-w-0">
                      <h4 className="font-bold text-slate-900 dark:text-white line-clamp-1 text-[10px] mb-0.5">{product.name}</h4>
                      <p className="text-[8px] text-slate-500 dark:text-slate-400 truncate">{product.category}</p>
                    </div>
                    <div className="mt-1 flex items-end justify-between w-full">
                      <span className="font-black text-[11px] text-indigo-600 dark:text-indigo-400">৳{product.price}</span>
                      <span className={cn(
                        "text-[8px] font-bold px-1 py-0.5 rounded",
                        isOutOfStock ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      )}>
                        {remainingStock}
                      </span>
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

      {/* Right Side: Cart / POS */}
      <div className="w-full lg:w-72 xl:w-80 flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex-shrink-0">
        <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
          <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
            <ShoppingCart className="text-indigo-600 dark:text-indigo-400" size={14} />
            Order
          </h3>
          <span className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 text-[9px] font-bold px-1.5 py-0.5 rounded-md">
            {cartItemsCount} Items
          </span>
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
                        onChange={(e) => updateNegotiatedPrice(item.product.id, Number(e.target.value))}
                        className={cn(
                          "w-14 bg-transparent border-b text-[10px] font-black focus:border-indigo-500 outline-none p-0 transition-colors",
                          item.negotiatedPrice !== item.product.price 
                            ? "text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800" 
                            : "text-indigo-600 dark:text-indigo-400 border-slate-200 dark:border-slate-700"
                        )}
                        title="Negotiated Price"
                      />
                      {item.negotiatedPrice !== item.product.price && (
                        <span className="text-[7px] font-bold text-amber-500 animate-pulse">!</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 rounded-md p-0.5 border border-slate-100 dark:border-slate-700">
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
            ))
          )}
        </div>

        {/* Checkout Section */}
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
              <span>Subtotal</span>
              <span>৳{cartTotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 py-1">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Received</span>
              <div className="relative flex-1 max-w-[100px]">
                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">৳</span>
                <input
                  type="number"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  placeholder={cartTotal.toString()}
                  className="w-full pl-4 pr-1.5 py-1 text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md outline-none focus:ring-1 focus:ring-indigo-500 text-right"
                />
              </div>
            </div>
            {Number(receivedAmount) > cartTotal && (
              <div className="flex justify-between text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                <span>Change</span>
                <span>৳{(Number(receivedAmount) - cartTotal).toFixed(2)}</span>
              </div>
            )}
            <div className="pt-1 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <span className="font-bold text-[11px] text-slate-900 dark:text-white">Total</span>
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
                                {format(sale.timestamp.toDate(), 'MMM dd, yyyy • HH:mm')}
                              </p>
                              {sale.unitPrice !== product?.price && (
                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 rounded">
                                  Negotiated: ৳{sale.unitPrice}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-slate-900 dark:text-white">৳{sale.totalPrice.toFixed(2)}</p>
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{sale.quantity} units</p>
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
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col"
            >
              <div className="p-6 text-center border-b border-dashed border-slate-200 dark:border-slate-800 relative">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Cash Memo</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Transaction Successful</p>
                <button 
                  onClick={() => setLastSale(null)}
                  className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto font-mono">
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Date: {format(lastSale.timestamp, 'yyyy-MM-dd')}</span>
                  <span>Time: {format(lastSale.timestamp, 'HH:mm:ss')}</span>
                </div>

                {lastSale.customer && (
                  <div className="py-2 border-y border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">Customer Info</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{lastSale.customer.name}</p>
                    <p className="text-[10px] text-slate-500">{lastSale.customer.phone}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">Items</p>
                  {lastSale.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <div className="flex-1 pr-4">
                        <p className="text-slate-800 dark:text-slate-200 truncate">{item.product.name}</p>
                        <p className="text-[10px] text-slate-500">{item.quantity} x ৳{item.negotiatedPrice}</p>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white">৳{(item.quantity * item.negotiatedPrice).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-dashed border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white">
                    <span>TOTAL</span>
                    <span>৳{lastSale.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>Received</span>
                    <span>৳{lastSale.received.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span>Change</span>
                    <span>৳{lastSale.change.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
                <button
                  onClick={() => window.print()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  <Printer size={16} />
                  Print Memo
                </button>
                <button
                  onClick={() => setLastSale(null)}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                >
                  Done
                </button>
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
    </div>
  );
}
