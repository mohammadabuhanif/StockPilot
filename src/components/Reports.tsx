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



  const printGlobalHtml = (bodyHtml: string, styleHtml: string = '') => {
    let printDiv = document.getElementById('global-print-container');
    if (!printDiv) {
      printDiv = document.createElement('div');
      printDiv.id = 'global-print-container';
      printDiv.className = 'print-only';
      document.body.appendChild(printDiv);
    }
    printDiv.innerHTML = styleHtml + '<div style="background:white; color:black; width:100%; height:100%;">' + bodyHtml + '</div>';
    setTimeout(() => {
      window.print();
      setTimeout(() => { if (printDiv) printDiv.innerHTML = ''; }, 500);
    }, 100);
  };

  const handlePrintBarcodes = () => {
    const selectedList = products.filter(p => selectedProducts.includes(p.id));
    if(!selectedList.length) return;
    const bodyHtml = Array.from({ length: labelQuantity }).map(() => 
      selectedList.map(p => `
        <div class="label-page">
          <div style="width: 100%; text-align: center;">
            <p style="font-size: 7pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin: 0; line-height: 1;">${settings?.shopName || 'SMART DIGITAL CARE'}</p>
          </div>
          <div style="width: 100%; text-align: center; margin: 1mm 0;">
            <p style="font-size: 9pt; font-weight: 900; text-transform: uppercase; margin: 0; line-height: 1.1; text-align: center;">${p.name}</p>
          </div>
          <div style="text-align:center;">
             <p style="font-family: monospace; font-size: 11pt; margin:0; letter-spacing: 2px;">*${(p.barcode || p.sku || p.id).substring(0,8).toUpperCase()}*</p>
          </div>
          <div style="display:flex; justify-content: space-between; width: 100%; align-items:flex-end;">
            <p style="font-size: 5pt; color: #666; margin:0;">${p.category || 'ITEM'}</p>
            <p style="font-size: 11pt; font-weight: 900; margin:0; line-height: 1;">৳${p.price}</p>
          </div>
        </div>
      `).join('')
    ).join('');

    const styleHtml = `<style>
        @page { size: 38mm 28mm !important; margin: 0 !important; }
        .label-page { width: 38mm; height: 28mm; display: flex; flex-direction: column; align-items: center; justify-content: center; page-break-after: always; overflow: hidden; box-sizing: border-box; padding: 1.5mm; background: white; color: black; }
        #global-print-container * { color: black !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    </style>`;
    
    printGlobalHtml(bodyHtml, styleHtml);
  };

  const handlePrintValuation = () => {
    const totalVal = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
    const bodyHtml = `
      <div style="padding: 40px; max-width: 800px; margin: auto; font-family: sans-serif;">
        <h1 style="text-align: center; border-bottom: 2px solid #ef4a23; padding-bottom: 20px;">Inventory Valuation Report</h1>
        <p><strong>Shop:</strong> ${settings?.shopName || 'STORE'}</p>
        <p><strong>Date Generated:</strong> ${new Date().toLocaleString()}</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 30px;">
          <thead>
            <tr>
              <th style="text-align: left; padding: 10px; border-bottom: 1px solid #ddd;">Product</th>
              <th style="padding: 10px; border-bottom: 1px solid #ddd;">Stock</th>
              <th style="text-align: right; padding: 10px; border-bottom: 1px solid #ddd;">Unit Price</th>
              <th style="text-align: right; padding: 10px; border-bottom: 1px solid #ddd;">Total Value</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(p => `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${p.name}</td>
                <td style="text-align:center; padding: 10px; border-bottom: 1px solid #eee;">${p.stock}</td>
                <td style="text-align:right; padding: 10px; border-bottom: 1px solid #eee;">৳${p.price.toLocaleString()}</td>
                <td style="text-align:right; padding: 10px; border-bottom: 1px solid #eee;">৳${(p.price * p.stock).toLocaleString()}</td>
              </tr>
            `).join('')}
            <tr style="font-weight: bold; background: #f9f9f9;">
              <td colspan="3" style="text-align:right; padding: 10px;">Total Valuation:</td>
              <td style="text-align:right; padding: 10px;">৳${totalVal.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    printGlobalHtml(bodyHtml);
  };

  const handlePrintReport = () => {
    const totalSales = sales.reduce((sum, s) => sum + ((s as any).total || s.totalPrice || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalService = serviceOrders.filter(so=>so.status==='completed').reduce((sum, so) => sum + (so.price || 0), 0);
    const totalIn = totalSales + totalService;
    
    const bodyHtml = `
      <div style="padding: 40px; max-width: 800px; margin: auto; font-family: sans-serif;">
        <h1 style="text-align: center; border-bottom: 2px solid #ef4a23; padding-bottom: 20px;">Financial Report</h1>
        <p><strong>Shop:</strong> ${settings?.shopName || 'STORE'}</p>
        <p><strong>Date Generated:</strong> ${new Date().toLocaleString()}</p>
        
        <div style="display:flex; justify-content: space-between; margin-top: 30px;">
           <div style="flex:1; background: #f8fafc; padding: 20px; border-radius: 12px; margin-right: 15px;">
              <h3 style="margin-top:0">Total Inflow</h3>
              <p style="font-size: 24px; font-weight: bold; margin:0;">৳${totalIn.toLocaleString()}</p>
           </div>
           <div style="flex:1; background: #fef2f2; padding: 20px; border-radius: 12px; margin-right: 15px;">
              <h3 style="margin-top:0; color:#ef4444;">Total Outflow</h3>
              <p style="font-size: 24px; font-weight: bold; margin:0; color:#ef4444;">৳${totalExpenses.toLocaleString()}</p>
           </div>
           <div style="flex:1; background: #f0fdf4; padding: 20px; border-radius: 12px;">
              <h3 style="margin-top:0; color:#10b981;">Net Balance</h3>
              <p style="font-size: 24px; font-weight: bold; margin:0; color:#10b981;">৳${(totalIn - totalExpenses).toLocaleString()}</p>
           </div>
        </div>
      </div>
    `;
    printGlobalHtml(bodyHtml);
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
                      onClick={handlePrintReport}
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
                  onClick={handlePrintValuation}
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
