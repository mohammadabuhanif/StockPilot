import { useState, useMemo, useEffect, useRef } from 'react';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, Timestamp, handleFirestoreError, OperationType, writeBatch } from '../firebase';
import { Product, Sale, Customer, Service, Settings } from '../types';
import { ShoppingCart, Search, Plus, Minus, Trash2, Package, AlertCircle, CheckCircle2, History, X, Filter, User, UserPlus, Zap, Barcode, Printer, Receipt, AlertTriangle, ChevronDown, Eye, EyeOff } from 'lucide-react';
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
}

interface CartItem {
  product: Product;
  quantity: number;
  negotiatedPrice: number | string;
}

export default function Sales({ products, sales, customers, services, settings }: SalesProps) {
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
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

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
  }, [cart, loading, discount]);

  // Focus barcode input on mount and periodically to ensure it's always ready
  useEffect(() => {
    const focusInterval = setInterval(() => {
      const activeElement = document.activeElement;
      const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
      if (!showHistory && !lastSale && !isInput) {
        barcodeInputRef.current?.focus();
      }
    }, 2000);
    return () => clearInterval(focusInterval);
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
          timestamp: Timestamp.now(),
          type: isService ? 'service' : 'product'
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
  };  const handlePrint = (customSale?: any) => {
    const saleData = customSale || lastSale;
    if (!saleData) return;

    // Show a hint that something is happening
    setShowPrintMessage(true);
    setTimeout(() => setShowPrintMessage(false), 5000);

    const logoUrl = "https://i.ibb.co/cX7qP4n6/Picsart-26-04-10-02-09-25-057.png";
    const timestamp = saleData.timestamp instanceof Date ? saleData.timestamp : (saleData.timestamp?.toDate ? saleData.timestamp.toDate() : new Date());

    const memoHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cash Memo - ${settings?.shopName || 'Digital Shop'}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
            body { 
              font-family: 'Courier Prime', monospace; 
              padding: 20px; 
              color: #000; 
              max-width: 400px; 
              margin: 0 auto;
              line-height: 1.2;
              background: white;
            }
            .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 15px; margin-bottom: 15px; }
            .logo { width: 180px; height: auto; margin-bottom: 5px; }
            .shop-info { font-size: 11px; margin: 2px 0; }
            .memo-title { font-size: 16px; font-weight: 700; margin-top: 10px; text-decoration: underline; }
            .details { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th { text-align: left; border-bottom: 1px solid #000; font-size: 10px; padding: 5px 0; }
            td { padding: 5px 0; font-size: 10px; vertical-align: top; }
            .total-section { border-top: 2px dashed #000; padding-top: 10px; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px; }
            .grand-total { font-weight: 700; font-size: 16px; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; margin: 8px 0; }
            .footer { text-align: center; margin-top: 30px; font-size: 10px; font-style: italic; border-top: 1px dashed #eee; padding-top: 10px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 50px; }
            .sig-line { width: 120px; border-top: 1px solid #000; text-align: center; font-size: 9px; padding-top: 4px; }
            @media print {
              body { padding: 0; margin: 0; width: 80mm; } /* Approx thermal width */
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logoUrl}" alt="Logo" class="logo" referrerPolicy="no-referrer" />
            <h1 style="margin: 5px 0; font-size: 18px;">${settings?.shopName || 'DIGITAL SHOP'}</h1>
            ${settings?.shopAddress ? `<p class="shop-info">${settings.shopAddress}</p>` : ''}
            ${settings?.shopPhone ? `<p class="shop-info">Phone: ${settings.shopPhone}</p>` : ''}
            ${settings?.shopEmail ? `<p class="shop-info">Email: ${settings.shopEmail}</p>` : ''}
            <div class="memo-title">CASH MEMO</div>
          </div>

          <div class="details">
            <span>Date: ${format(timestamp, 'yyyy-MM-dd')}</span>
            <span>Time: ${formatAppTime(timestamp)}</span>
          </div>

          ${(saleData.customer || saleData.customerName) ? `
            <div style="font-size: 10px; margin-bottom: 15px; padding: 6px; border: 1px solid #000;">
              <strong>CUSTOMER:</strong> ${(saleData.customer?.name || saleData.customerName || 'N/A').toUpperCase()}<br>
              ${saleData.customer?.phone ? `<strong>PHONE:</strong> ${saleData.customer.phone}` : ''}
            </div>
          ` : ''}

          <table>
            <thead>
              <tr>
                <th style="width: 50%;">ITEM</th>
                <th style="text-align: center; width: 10%;">QTY</th>
                <th style="text-align: right; width: 20%;">RATE</th>
                <th style="text-align: right; width: 20%;">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${saleData.items ? saleData.items.map((item: any) => `
                <tr>
                  <td>${item.product.name.toUpperCase()}</td>
                  <td style="text-align: center;">${item.quantity}</td>
                  <td style="text-align: right;">${Number(item.negotiatedPrice || 0).toFixed(0)}</td>
                  <td style="text-align: right;">${(item.quantity * Number(item.negotiatedPrice || 0)).toFixed(0)}</td>
                </tr>
              `).join('') : `
                <tr>
                  <td>${(saleData.productName || 'Product').toUpperCase()}</td>
                  <td style="text-align: center;">${saleData.quantity || 1}</td>
                  <td style="text-align: right;">${Number(saleData.unitPrice || 0).toFixed(0)}</td>
                  <td style="text-align: right;">${Number(saleData.totalPrice || 0).toFixed(0)}</td>
                </tr>
              `}
            </tbody>
          </table>

          <div class="total-section">
            <div class="total-row">
              <span>SUBTOTAL:</span>
              <span>৳${((saleData.total || saleData.totalPrice || 0) + (saleData.discount || 0)).toFixed(2)}</span>
            </div>
            ${(saleData.discount || 0) > 0 ? `
              <div class="total-row" style="color: #444;">
                <span>DISCOUNT:</span>
                <span>-৳${Number(saleData.discount || 0).toFixed(2)}</span>
              </div>
            ` : ''}
            <div class="total-row grand-total">
              <span>NET PAYABLE:</span>
              <span>৳${(saleData.total || saleData.totalPrice || 0).toFixed(2)}</span>
            </div>
            ${saleData.received ? `
            <div class="total-row">
              <span>RECEIVED:</span>
              <span>৳${(saleData.received || 0).toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span>CHANGE:</span>
              <span>৳${(saleData.change || 0).toFixed(2)}</span>
            </div>
            ` : ''}
          </div>

          <div class="footer">
            ${settings?.memoFooter || 'Thank you for your business!'}
            <p style="margin-top: 10px; font-size: 8px; opacity: 0.5;">Powered by StockPilot</p>
          </div>

          <div class="signatures">
            <div class="sig-line">Customer</div>
            <div class="sig-line">Authorized</div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    // Try iframe printing first (isolated)
    try {
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.left = '-9999px';
      printFrame.style.top = '-9999px';
      printFrame.style.width = '1px';
      printFrame.style.height = '1px';
      document.body.appendChild(printFrame);

      const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(memoHtml);
        frameDoc.close();
        
        // Let it clean itself up or we can cleanup after some time
        setTimeout(() => {
          if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
          }
        }, 30000); // Wait long enough for print dialog
      } else {
        // Fallback to main window print
        window.print();
      }
    } catch (e) {
      console.error("Print error:", e);
      window.print(); // Final fallback
    }
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
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500"
                autoFocus
              />
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
                                {formatAppDateTime(sale.timestamp.toDate())}
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
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col print-only"
            >
              <div className="p-6 text-center border-b border-dashed border-slate-200 dark:border-slate-800 relative">
                <img 
                  src="https://i.ibb.co/cX7qP4n6/Picsart-26-04-10-02-09-25-057.png" 
                  alt="Logo" 
                  className="w-32 h-auto mx-auto mb-4 hidden print:block" 
                  referrerPolicy="no-referrer" 
                />
                <div className="print:hidden w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1 uppercase tracking-tight">
                  {settings?.shopName || 'DIGITAL SHOP'}
                </h2>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold">Cash Memo</p>
                {settings?.shopAddress && (
                  <p className="text-[8px] text-slate-400 mt-1 max-w-[200px] mx-auto leading-tight">{settings.shopAddress}</p>
                )}
                {settings?.shopPhone && (
                  <p className="text-[8px] text-slate-400 mt-0.5">Phone: {settings.shopPhone}</p>
                )}
                <button 
                  onClick={() => setLastSale(null)}
                  className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 print:hidden"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto font-mono print:max-h-none print:overflow-visible">
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Date: {format(lastSale.timestamp, 'yyyy-MM-dd')}</span>
                  <span>Time: {formatAppTime(lastSale.timestamp)}</span>
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
                      <span className="font-bold text-slate-900 dark:text-white">৳{(item.quantity * Number(item.negotiatedPrice || 0)).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-dashed border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white">
                    <span>TOTAL</span>
                    <span>৳{(lastSale.total || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>Received</span>
                    <span>৳{(lastSale.received || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span>Change</span>
                    <span>৳{(lastSale.change || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="pt-8 text-center space-y-4">
                  <p className="text-[10px] text-slate-400 italic">
                    {settings?.memoFooter || 'Thank you for your business!'}
                  </p>
                  <div className="flex justify-between pt-8">
                    <div className="w-24 border-t border-slate-300 dark:border-slate-700 pt-1">
                      <p className="text-[8px] text-slate-400">Customer Signature</p>
                    </div>
                    <div className="w-24 border-t border-slate-300 dark:border-slate-700 pt-1">
                      <p className="text-[8px] text-slate-400">Authorized Signature</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex gap-3 print:hidden">
                <button
                  onClick={handlePrint}
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
