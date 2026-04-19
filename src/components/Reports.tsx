import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Printer, 
  FileText, 
  BarChart3, 
  Tag, 
  Calendar, 
  ChevronRight, 
  Download, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Search,
  ArrowRight,
  TrendingDown
} from 'lucide-react';
import { format } from 'date-fns';
import { Product, Sale, ServiceOrder, Expense, Customer, Settings } from '../types';
import { cn } from '../lib/utils';
import { db, collection, query, orderBy, getDocs } from '../firebase';

interface ReportsProps {
  products: Product[];
  sales: Sale[];
  serviceOrders: ServiceOrder[];
  expenses: Expense[];
  customers: Customer[];
  settings: Settings | null;
}

type ReportType = 'barcode' | 'sales' | 'inventory' | 'services' | 'financial';

export default function Reports({ products, sales, serviceOrders, expenses, customers, settings }: ReportsProps) {
  const [activeReport, setActiveReport] = useState<ReportType>('barcode');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [labelQuantity, setLabelQuantity] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleProductSelection = (id: string) => {
    setSelectedProducts(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handlePrintBarcodes = () => {
    setIsPrinting(true);
    const selectedList = products.filter(p => selectedProducts.includes(p.id));
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Barcode Labels</title>
          <style>
            @media print {
              @page { margin: 0; size: 80mm 30mm; }
              body { margin: 0; padding: 0; }
            }
            .label-page {
              padding: 5mm;
              display: flex;
              flex-wrap: wrap;
              gap: 5mm;
              background: white;
            }
            .label-item {
              width: 35mm;
              height: 20mm;
              border: 1px dashed #ccc;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              page-break-inside: avoid;
              font-family: -apple-system, system-ui, sans-serif;
            }
            .shop-name { font-size: 8px; font-weight: bold; margin-bottom: 2px; text-transform: uppercase; }
            .product-name { font-size: 7px; margin-bottom: 4px; max-width: 90%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
            .barcode { font-family: 'Libre Barcode 39', cursive; font-size: 24px; margin: 2px 0; }
            .barcode-text { font-size: 8px; font-weight: bold; letter-spacing: 2px; }
            .price { font-size: 10px; font-weight: 800; margin-top: 2px; }
          </style>
          <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap" rel="stylesheet">
        </head>
        <body>
          <div class="label-page">
            ${selectedList.map(p => Array(labelQuantity).fill(0).map(() => `
              <div class="label-item">
                <div class="shop-name">${settings?.shopName || 'DIGITAL SHOP'}</div>
                <div class="product-name">${p.name}</div>
                <div class="barcode">*${p.barcode || p.id.slice(0, 8)}*</div>
                <div class="barcode-text">${p.barcode || p.id.slice(0, 8)}</div>
                <div class="price">৳${p.price}</div>
              </div>
            `).join('')).join('')}
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 1000);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setIsPrinting(false);
  };

  const handlePrintDailyReport = () => {
    setIsPrinting(true);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const todaySales = sales.filter(s => {
      const saleDate = s.timestamp instanceof Date ? s.timestamp : (s.timestamp?.toDate ? s.timestamp.toDate() : new Date());
      saleDate.setHours(0,0,0,0);
      return saleDate.getTime() === today.getTime();
    });

    const totalRevenue = todaySales.reduce((acc, s) => acc + s.totalPrice, 0);
    const totalProfit = todaySales.reduce((acc, s) => acc + s.totalProfit, 0);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Daily Sales Report - ${format(new Date(), 'yyyy-MM-dd')}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; font-size: 12px; }
            .header { text-align: center; border-bottom: 2px solid #000; margin-bottom: 20px; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
            .total-row { font-weight: bold; border-top: 2px solid #000; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${settings?.shopName || 'Digital Shop'}</h2>
            <h3>DAILY SALES REPORT</h3>
            <p>Date: ${format(new Date(), 'EEEE, MMMM do, yyyy')}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${todaySales.map(s => `
                <tr>
                  <td>${format(s.timestamp instanceof Date ? s.timestamp : s.timestamp.toDate(), 'HH:mm')}</td>
                  <td>${s.productName}</td>
                  <td>${s.quantity}</td>
                  <td>৳${s.unitPrice}</td>
                  <td>৳${s.totalPrice}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="4">TOTAL REVENUE</td>
                <td>৳${totalRevenue.toFixed(2)}</td>
              </tr>
              <tr class="total-row">
                <td colspan="4">TOTAL PROFIT</td>
                <td>৳${totalProfit.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
    setIsPrinting(false);
  };

  return (
    <div className="h-[calc(100vh-12rem)] lg:h-[calc(100vh-7rem)] flex flex-col gap-4 -m-1 p-1">
      {/* Header Container */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <FileText className="text-indigo-600" size={32} />
            Reports Hub
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Generate & print shop reports</p>
        </div>
        
        {activeReport === 'barcode' && selectedProducts.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 w-full sm:w-auto"
          >
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-wider font-black text-slate-400">Qty per item</span>
              <input 
                type="number"
                min="1"
                value={labelQuantity}
                onChange={(e) => setLabelQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-3 py-1 font-bold text-center"
              />
            </div>
            <button 
              onClick={handlePrintBarcodes}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-3 rounded-2xl shadow-lg transition-all"
            >
              <Printer size={20} />
              Print {selectedProducts.length * labelQuantity} Labels
            </button>
          </motion.div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* Navigation Rail */}
        <aside className="lg:w-72 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-3 shadow-sm flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible no-scrollbar">
          <ReportNavItem 
            id="barcode"
            active={activeReport === 'barcode'}
            onClick={() => setActiveReport('barcode')}
            icon={<Tag size={20} />}
            label="Barcode Stamps"
            description="Label printing for stock"
          />
          <ReportNavItem 
            id="sales"
            active={activeReport === 'sales'}
            onClick={() => setActiveReport('sales')}
            icon={<BarChart3 size={20} />}
            label="Sales Ledger"
            description="Daily/Range summaries"
          />
          <ReportNavItem 
            id="inventory"
            active={activeReport === 'inventory'}
            onClick={() => setActiveReport('inventory')}
            icon={<Download size={20} />}
            label="Stock Report"
            description="Current asset valuation"
          />
          <ReportNavItem 
            id="financial"
            active={activeReport === 'financial'}
            onClick={() => setActiveReport('financial')}
            icon={<TrendingDown size={20} />}
            label="P&L Summary"
            description="Profit & Loss analysis"
          />
        </aside>

        {/* Report Content */}
        <main className="flex-1 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col relative">
          <AnimatePresence mode="wait">
            {activeReport === 'barcode' && (
              <motion.div 
                key="barcode"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col h-full p-6"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text"
                      placeholder="Search inventory to print labels..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl pl-12 pr-4 py-3 font-bold placeholder:text-slate-400 focus:ring-2 ring-indigo-500/20"
                    />
                  </div>
                  <button 
                    onClick={() => setSelectedProducts(filteredProducts.map(p => p.id))}
                    className="text-xs font-black text-indigo-600 hover:text-indigo-700 p-2"
                  >
                    Select All
                  </button>
                  <button 
                    onClick={() => setSelectedProducts([])}
                    className="text-xs font-black text-slate-400 hover:text-slate-600 p-2"
                  >
                    Clear
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {filteredProducts.map((product) => (
                    <div 
                      key={product.id}
                      onClick={() => toggleProductSelection(product.id)}
                      className={cn(
                        "group flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer",
                        selectedProducts.includes(product.id)
                          ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30"
                          : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-sm",
                          selectedProducts.includes(product.id)
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                        )}>
                          <Tag size={18} />
                        </div>
                        <div>
                          <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{product.name}</p>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{product.category}</span>
                            <span>SKU: {product.barcode || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-black text-slate-900 dark:text-white">৳{product.price}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{product.stock} in stock</p>
                        </div>
                        <div className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                          selectedProducts.includes(product.id)
                            ? "bg-indigo-600 border-indigo-600"
                            : "border-slate-200 dark:border-slate-700"
                        )}>
                          {selectedProducts.includes(product.id) && <CheckCircle2 size={14} className="text-white" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeReport === 'sales' && (
              <motion.div 
                key="sales"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-8 flex flex-col gap-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-950/30 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
                      <Calendar className="text-indigo-600" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1 uppercase tracking-tight">Today Summary</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 font-medium">Full list of transactions for today</p>
                    <button 
                      onClick={handlePrintDailyReport}
                      className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black py-4 rounded-2xl flex items-center justify-center gap-2"
                    >
                      <Printer size={20} />
                      Generate Printout
                    </button>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950/30 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 opacity-50">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                      <Download size={24} className="text-emerald-600" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1 uppercase tracking-tight">Export All</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 font-medium">Download full history as spreadsheet</p>
                    <button disabled className="w-full bg-slate-200 dark:bg-slate-800 text-slate-400 font-black py-4 rounded-2xl cursor-not-allowed">
                      CSV Coming Soon
                    </button>
                  </div>
                </div>

                <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center bg-slate-50/50 dark:bg-slate-950/10">
                   <BarChart3 className="mx-auto text-slate-300 mb-4" size={48} />
                   <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-sm mb-2">Custom Range Logic</h4>
                   <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">More advanced date picking and specific category reporting features are being integrated into this hub.</p>
                </div>
              </motion.div>
            )}

            {activeReport === 'inventory' && (
              <motion.div 
                key="inventory"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-8 space-y-8"
              >
                <div className="bg-indigo-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-500/20">
                  <div className="relative z-10">
                    <p className="text-[10px] uppercase font-black tracking-[0.2em] opacity-80 mb-2 underline underline-offset-4">Stock Valuation</p>
                    <h2 className="text-4xl font-black tracking-tight mb-2 uppercase">৳{products.reduce((acc, p) => acc + (p.stock * p.cost), 0).toLocaleString()}</h2>
                    <p className="text-sm font-bold opacity-70">Total asset value at cost price</p>
                  </div>
                  <Download className="absolute top-1/2 right-10 -translate-y-1/2 opacity-10 w-40 h-40" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="p-6 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                     <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Low Stock Alerts</p>
                       <p className="text-2xl font-black text-red-500">{products.filter(p => p.stock <= p.minStock).length}</p>
                     </div>
                     <ArrowRight size={24} className="text-slate-300" />
                   </div>
                   <div className="p-6 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                     <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active SKUs</p>
                       <p className="text-2xl font-black text-indigo-600">{products.length}</p>
                     </div>
                     <ChevronRight size={24} className="text-slate-300" />
                   </div>
                </div>

                <button 
                  onClick={() => {
                    const html = `
                      <html>
                        <head>
                          <title>Inventory Valuation Report</title>
                          <style>
                             body { font-family: sans-serif; padding: 40px; }
                             table { width: 100%; border-collapse: collapse; }
                             th, td { text-align: left; padding: 12px; border-bottom: 1px solid #eee; }
                             .total { font-weight: bold; background: #f9f9f9; }
                          </style>
                        </head>
                        <body>
                          <h1>${settings?.shopName || 'Digital Shop'}</h1>
                          <h2>INVENTORY VALUATION REPORT - ${new Date().toLocaleDateString()}</h2>
                          <table>
                            <thead>
                              <tr>
                                <th>Item</th>
                                <th>Stock</th>
                                <th>Cost</th>
                                <th>Valuation</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${products.map(p => `
                                <tr>
                                  <td>${p.name}</td>
                                  <td>${p.stock}</td>
                                  <td>৳${p.cost}</td>
                                  <td>৳${p.stock * p.cost}</td>
                                </tr>
                              `).join('')}
                              <tr class="total">
                                <td colspan="3">GRAND TOTAL</td>
                                <td>৳${products.reduce((acc, p) => acc + (p.stock * p.cost), 0)}</td>
                              </tr>
                            </tbody>
                          </table>
                          <script>window.onload=()=>window.print()</script>
                        </body>
                      </html>
                    `;
                    const w = window.open('', '_blank');
                    if(w) { w.document.write(html); w.document.close(); }
                  }}
                  className="w-full border-4 border-slate-900 dark:border-white text-slate-900 dark:text-white font-black py-4 rounded-3xl hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 transition-all flex items-center justify-center gap-3"
                >
                  <Download size={20} />
                  Print Valuation Report
                </button>
              </motion.div>
            )}

            {activeReport === 'financial' && (
              <motion.div 
                key="financial"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-8 flex flex-col h-full"
              >
                 <div className="flex-1 flex flex-col justify-center items-center gap-4 text-center">
                    <div className="w-20 h-20 rounded-[2.5rem] bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-4">
                      <TrendingDown className="text-indigo-600" size={40} />
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Profit Loss Ledger</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium max-w-md">Detailed financial breakdown including operational costs, net profit, and tax ready summaries for the selected period.</p>
                    
                    <div className="mt-8 p-6 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-3xl max-w-sm">
                       <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
                         <AlertCircle size={14} />
                         Coming Soon
                       </p>
                       <p className="text-[10px] text-amber-600 dark:text-amber-500 font-bold">This section is currently being updated to include automated tax calculation and service commission splits.</p>
                    </div>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function ReportNavItem({ id, active, onClick, icon, label, description }: { 
  id: string, 
  active: boolean, 
  onClick: () => void, 
  icon: React.ReactNode, 
  label: string, 
  description: string 
}) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex-1 lg:flex-none flex items-center gap-4 p-4 rounded-3xl border-2 transition-all text-left group",
        active 
          ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 scale-105 z-10" 
          : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-100 dark:hover:border-indigo-900/30"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-2xl flex items-center justify-center transition-colors shrink-0",
        active ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20"
      )}>
        {icon}
      </div>
      <div className="hidden lg:block">
        <p className={cn("font-black text-sm uppercase tracking-tight leading-none mb-1", active ? "text-white" : "text-slate-900 dark:text-white")}>
          {label}
        </p>
        <p className={cn("text-[10px] font-medium leading-tight", active ? "text-indigo-100" : "text-slate-500")}>
          {description}
        </p>
      </div>
      <div className="lg:hidden">
        <p className="font-black text-xs uppercase tracking-tighter shrink-0">{label}</p>
      </div>
    </button>
  );
}
