import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import { 
  Cpu, HardDrive, Monitor, Search, X, ArrowLeft, Plus, 
  Printer, Share2, Save, CheckCircle, Zap, ShoppingCart, 
  RefreshCw, CheckCircle2, AlertTriangle, Filter, Trash2, ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface PCBuilderProps {
  products: Product[];
  onBack: () => void;
}

type ComponentType = 'CPU' | 'CPU Cooler' | 'Motherboard' | 'RAM' | 'Storage' | 'Graphics Card' | 'Power Supply' | 'Casing' | 'Monitor';

const COMPONENTS_LIST: { id: ComponentType, name: string, icon: any, required?: boolean }[] = [
  { id: 'CPU', name: 'Processor', icon: Cpu, required: true },
  { id: 'CPU Cooler', name: 'CPU Cooler', icon: RefreshCw },
  { id: 'Motherboard', name: 'Motherboard', icon: HardDrive, required: true },
  { id: 'RAM', name: 'RAM (Desktop)', icon: HardDrive, required: true },
  { id: 'Storage', name: 'Storage', icon: HardDrive, required: true },
  { id: 'Graphics Card', name: 'Graphics Card', icon: Monitor },
  { id: 'Power Supply', name: 'Power Supply', icon: Zap, required: true },
  { id: 'Casing', name: 'Casing', icon: HardDrive, required: true },
  { id: 'Monitor', name: 'Monitor', icon: Monitor }
];

export function PCBuilder({ products, onBack }: PCBuilderProps) {
  const [build, setBuild] = useState<Record<ComponentType, Product | null>>({
    'CPU': null,
    'CPU Cooler': null,
    'Motherboard': null,
    'RAM': null,
    'Storage': null,
    'Graphics Card': null,
    'Power Supply': null,
    'Casing': null,
    'Monitor': null
  });

  const [selectingStep, setSelectingStep] = useState<ComponentType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Helper for Socket matching
  const getSockets = (product: Product) => {
    const specs = product.specifications || {};
    const socketStrings = Object.entries(specs).find(([k]) => k.toLowerCase().includes('socket') || k.toLowerCase().includes('supported cpu'));
    if (socketStrings) return socketStrings[1].toLowerCase();
    if (product.specifications?.Socket) return product.specifications.Socket.toLowerCase();
    return '';
  };

  // Helper for RAM Type matching (DDR4/DDR5)
  const getMemoryType = (product: Product) => {
    const specs = product.specifications || {};
    const memStrings = Object.entries(specs).find(([k]) => k.toLowerCase().includes('memory') || k.toLowerCase().includes('ram type'));
    if (memStrings) return memStrings[1].toLowerCase();
    if (product.specifications?.['Memory Type']) return product.specifications['Memory Type'].toLowerCase();
    
    // Check name as fallback
    if (product.name.toLowerCase().includes('ddr5')) return 'ddr5';
    if (product.name.toLowerCase().includes('ddr4')) return 'ddr4';
    return '';
  };

  const getCompatibleProducts = (type: ComponentType) => {
    let list = products.filter(p => p.category.toLowerCase().includes(type.toLowerCase()));
    
    // Fallback Dummy Products if inventory is empty for this category
    if (list.length === 0) {
      if (type === 'CPU') {
        list = [
          { id: 'cpu-1', name: 'AMD Ryzen 5 7600X 6-Core Base 4.7GHz', category: type, price: 24500, stock: 5, minStock: 2, specifications: { 'Socket': 'AM5' }, imageUrl: '' } as any,
          { id: 'cpu-2', name: 'Intel Core i5-13400F 10-Cores', category: type, price: 22000, stock: 5, minStock: 2, specifications: { 'Socket': 'LGA 1700' }, imageUrl: '' } as any
        ];
      } else if (type === 'Motherboard') {
        list = [
          { id: 'mb-1', name: 'MSI PRO B650M-A WIFI DDR5 AM5', category: type, price: 18500, stock: 5, minStock: 2, specifications: { 'Socket': 'AM5', 'Memory Type': 'DDR5' }, imageUrl: '' } as any,
          { id: 'mb-2', name: 'Gigabyte B760M DS3H DDR4 LGA1700', category: type, price: 15500, stock: 5, minStock: 2, specifications: { 'Socket': 'LGA 1700', 'Memory Type': 'DDR4' }, imageUrl: '' } as any
        ];
      } else if (type === 'RAM') {
        list = [
          { id: 'ram-1', name: 'Corsair Vengeance 16GB 5200MHz DDR5', category: type, price: 6500, stock: 10, minStock: 2, specifications: { 'Memory Type': 'DDR5' }, imageUrl: '' } as any,
          { id: 'ram-2', name: 'G.Skill Ripjaws V 16GB 3200MHz DDR4', category: type, price: 4200, stock: 10, minStock: 2, specifications: { 'Memory Type': 'DDR4' }, imageUrl: '' } as any
        ];
      } else {
        list = [
          { id: `dummy-${type}-1`, name: `Premium ${type} Model X`, category: type, price: 5000, stock: 10, minStock: 2, specifications: { 'Brand': 'Generic' }, imageUrl: '' } as any
        ];
      }
    }

    // Compatibility Checks
    if (type === 'Motherboard' && build['CPU']) {
       const requiredSocket = getSockets(build['CPU']);
       if (requiredSocket) {
         list = list.filter(p => {
            const mbSocket = getSockets(p);
            return mbSocket.includes(requiredSocket) || requiredSocket.includes(mbSocket) || mbSocket === '';
         });
       }
    }
    
    if (type === 'CPU' && build['Motherboard']) {
       const requiredSocket = getSockets(build['Motherboard']);
       if (requiredSocket) {
         list = list.filter(p => {
            const cpuSocket = getSockets(p);
            return cpuSocket.includes(requiredSocket) || requiredSocket.includes(cpuSocket) || cpuSocket === '';
         });
       }
    }

    if (type === 'RAM' && build['Motherboard']) {
      const requiredRam = getMemoryType(build['Motherboard']);
      if (requiredRam) {
        list = list.filter(p => {
          const ramType = getMemoryType(p);
          return ramType.includes(requiredRam) || requiredRam.includes(ramType) || ramType === '';
        });
      }
    }

    if (type === 'Motherboard' && build['RAM']) {
      const requiredRam = getMemoryType(build['RAM']);
      if (requiredRam) {
        list = list.filter(p => {
          const mbRam = getMemoryType(p);
          return mbRam.includes(requiredRam) || requiredRam.includes(mbRam) || mbRam === '';
        });
      }
    }

    if (searchQuery) {
       list = list.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    return list;
  };

  const selectComponent = (step: ComponentType, product: Product) => {
    setBuild(prev => ({ ...prev, [step]: product }));
    setSelectingStep(null);
    setSearchQuery('');
  };

  const removeComponent = (step: ComponentType) => {
    setBuild(prev => ({ ...prev, [step]: null }));
  };

  const clearBuild = () => {
     if(window.confirm('Are you sure you want to clear your current build?')) {
        setBuild({
          'CPU': null, 'CPU Cooler': null, 'Motherboard': null, 
          'RAM': null, 'Storage': null, 'Graphics Card': null, 
          'Power Supply': null, 'Casing': null, 'Monitor': null
        });
     }
  };

  const getTotal = () => {
    return Object.values(build).reduce((acc, p) => acc + (p ? Number(p.price || 0) : 0), 0);
  };

  const getEstimatedWattage = () => {
    let total = 0;
    if (build['CPU']) total += 95; // Avg 95W
    if (build['Graphics Card']) total += 250; // Avg 250W
    if (build['Motherboard']) total += 40;
    if (build['RAM']) total += 15;
    if (build['Storage']) total += 10;
    if (build['CPU Cooler']) total += 15;
    Object.values(build).forEach(p => { if (p) total += 5; }); // Fan buffers
    return Math.max(0, total);
  };

  const handleCheckout = () => {
    let orderDetails = "Hi! I want to order a custom PC Build:\n\n";
    COMPONENTS_LIST.forEach(comp => {
      if (build[comp.id]) {
        orderDetails += `*${comp.name}:* ${build[comp.id]?.name} (৳${build[comp.id]?.price.toLocaleString()})\n`;
      }
    });
    orderDetails += `\n*Total Estimate:* ৳${getTotal().toLocaleString()}`;
    orderDetails += `\n*Estimated Wattage:* ${getEstimatedWattage()}W\n`;
    orderDetails += `\nIs this combination available?`;

    const encodedMessage = encodeURIComponent(orderDetails);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const handlePrint = () => {
    const printContent = document.getElementById('pc-build-print-content')?.innerHTML;
    if (printContent) {
      let printDiv = document.querySelector('.temp-print-container') as HTMLDivElement;
      if (!printDiv) {
        printDiv = document.createElement('div');
        printDiv.className = 'global-print-container temp-print-container';
        document.body.appendChild(printDiv);
      }
      printDiv.innerHTML = printContent;
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          if (printDiv) printDiv.innerHTML = '';
        }, 1000);
      }, 100);
    } else {
      window.print(); // Fallback
    }
  };

  // Selection view
  if (selectingStep) {
    const availableProducts = getCompatibleProducts(selectingStep);

    return (
      <div className="bg-slate-50 min-h-screen pb-24 font-sans animate-in fade-in duration-300">
         <div className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
           <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => { setSelectingStep(null); setSearchQuery(''); }} className="p-2 hover:bg-slate-100 text-slate-500 rounded-full transition-colors">
                   <ArrowLeft size={24} />
                </button>
                <div>
                   <h2 className="font-black text-xl text-slate-800 uppercase tracking-tight">Select <span className="text-[#ef4a23]">{selectingStep}</span></h2>
                   <p className="text-slate-500 text-xs font-medium">Compatible components for your build</p>
                </div>
              </div>
           </div>
           
           <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center gap-4">
              <div className="relative flex-1 max-w-2xl">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                 <input 
                   type="text" 
                   placeholder={`Search ${selectingStep}s...`}
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                   className="w-full bg-white border border-slate-300 rounded-xl pl-12 pr-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-[#ef4a23]/20 focus:border-[#ef4a23] outline-none shadow-sm transition-all"
                 />
              </div>
              <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
                <Filter size={16} /> Filters
              </button>
           </div>
         </div>

         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
           <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="divide-y divide-slate-100">
               {availableProducts.length > 0 ? availableProducts.map(p => (
                 <div key={p.id} className="flex flex-col sm:flex-row gap-4 p-4 hover:bg-slate-50/80 transition-colors items-start sm:items-center group">
                   <div className="w-24 h-24 bg-white border border-slate-100 rounded-xl shrink-0 overflow-hidden flex items-center justify-center p-2 shadow-sm">
                      {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform" /> : <Monitor className="text-slate-200" size={32} />}
                   </div>
                   <div className="flex-1 min-w-0">
                     <p className="text-base font-black text-slate-800 line-clamp-2 leading-tight group-hover:text-[#ef4a23] transition-colors">{p.name}</p>
                     
                     {/* Key Specs Pills */}
                     <div className="flex flex-wrap gap-2 mt-3">
                        {Object.entries(p.specifications || {}).slice(0, 4).map(([k, v]) => (
                          <span key={k} className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded-md border border-slate-200/50">
                            <span className="text-slate-400 mr-1">{k}:</span> {v}
                          </span>
                        ))}
                     </div>
                   </div>

                   <div className="sm:text-right shrink-0 flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-slate-100">
                     <p className="text-xl text-[#ef4a23] font-black">৳{p.price.toLocaleString()}</p>
                     <button 
                       onClick={() => selectComponent(selectingStep, p)}
                       className="px-6 py-2.5 mt-2 bg-[#081621] hover:bg-[#ef4a23] text-white text-xs font-black uppercase tracking-widest rounded-xl transition-colors shadow-lg shadow-black/10 group-hover:shadow-[#ef4a23]/20"
                     >
                       Select
                     </button>
                   </div>
                 </div>
               )) : (
                 <div className="py-20 text-center text-slate-500">
                   <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                     <Search className="text-slate-300" size={32} />
                   </div>
                   <h3 className="text-lg font-bold text-slate-700 mb-1">No Components Found</h3>
                   <p className="text-sm">We couldn't find any compatible components in this category.</p>
                 </div>
               )}
             </div>
           </div>
         </div>
      </div>
    );
  }

  // Calculate Progress (Required Components)
  const requiredComps = COMPONENTS_LIST.filter(c => c.required);
  const selectedRequired = requiredComps.filter(c => build[c.id]);
  const progressPercent = Math.round((selectedRequired.length / requiredComps.length) * 100);

  return (
    <>
      {/* --- INVISIBLE PRINT COMPONENT (Native CSS Print) --- */}
      <div className="hidden">
        <div id="pc-build-print-content" className="p-8 text-black bg-white font-sans w-full">
          <style>{`
            @media print {
              #pc-build-print-content { width: 100%; max-width: 21cm; margin: 0 auto; background: white !important; padding: 20px; }
              #pc-build-print-content * { color: black !important; }
            }
          `}</style>
          <div className="text-center border-b-2 border-[#ef4a23] pb-5 mb-8">
          <h1 className="text-3xl font-black m-0">Custom PC Build Summary</h1>
          <p className="mt-2 text-slate-500">Generated by SDC PC Builder</p>
        </div>
        <table className="w-full text-left border-collapse mb-8">
          <thead>
            <tr>
              <th className="p-3 border-b border-slate-200">Component</th>
              <th className="p-3 border-b border-slate-200">Selection</th>
              <th className="p-3 border-b border-slate-200">Price</th>
            </tr>
          </thead>
          <tbody>
            {COMPONENTS_LIST.map((comp) => (
              <tr key={comp.id}>
                <td className="p-3 border-b border-slate-100 font-bold">{comp.name}</td>
                <td className="p-3 border-b border-slate-100">
                  {build[comp.id] ? build[comp.id]?.name : <span className="italic text-slate-400">Not Selected</span>}
                </td>
                <td className="p-3 border-b border-slate-100 font-medium">
                  {build[comp.id] ? `৳${build[comp.id]?.price.toLocaleString()}` : '-'}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50">
              <td colSpan={2} className="p-3 text-right font-bold">Total Price:</td>
              <td className="p-3 font-black text-lg">৳{getTotal().toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-center text-slate-600 font-medium">Estimated Power Draw: <span className="font-bold text-black">{getEstimatedWattage()}W</span></p>
        <p className="text-center text-xs text-slate-400 mt-12">Pricing and availability are subject to change.</p>
        </div>
      </div>

    <div className="min-h-screen bg-[#f8fafc] font-sans pb-24 print:hidden">
      {/* Top Banner Area */}
      <div className="bg-[#081621] border-b border-[#ef4a23]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4 text-xs font-bold uppercase tracking-wider w-fit">
            <ArrowLeft size={16} /> Back to Storefront
          </button>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight uppercase">Custom PC <span className="text-[#ef4a23]">Builder</span></h1>
              <p className="text-slate-400 text-sm sm:text-base mt-2 max-w-xl">Build your dream setup with our intelligent compatibility checker. We guarantee components fit together perfectly.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={clearBuild}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-red-500/10 text-slate-300 hover:text-red-400 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
              >
                <Trash2 size={16} /> Clear Build
              </button>
              <button 
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#ef4a23]/10 hover:bg-[#ef4a23] text-[#ef4a23] hover:text-white border border-[#ef4a23]/30 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
             >
                <Printer size={16} /> Print
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Builder List (Left Col) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">Core Components</h3>
                
                {/* Visual Compatibility Alert */}
                {progressPercent === 100 ? (
                  <span className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border border-emerald-200">
                    <CheckCircle2 size={14} /> Fully Compatible
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border border-amber-200">
                    <AlertTriangle size={14} /> Review Specs Carefully
                  </span>
                )}
              </div>
              
              <div className="divide-y divide-slate-100">
                {COMPONENTS_LIST.map((comp) => {
                  const product = build[comp.id];
                  
                  return (
                    <div key={comp.id} className="p-4 sm:p-6 flex flex-col md:flex-row md:items-center gap-4 sm:gap-6 hover:bg-slate-50/50 transition-colors">
                      
                      {/* Component Label */}
                      <div className="w-full md:w-40 flex items-center gap-3 shrink-0">
                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                          <comp.icon size={20} />
                        </div>
                        <div>
                          <p className="font-black text-slate-700 text-sm leading-tight">{comp.name}</p>
                          {comp.required && <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Required</span>}
                        </div>
                      </div>
                      
                      {/* Selected Details */}
                      <div className="flex-1 min-w-0 border-l border-slate-100 md:pl-6">
                        {product ? (
                          <div className="flex gap-4">
                            <div className="w-16 h-16 bg-white border border-slate-100 rounded-lg shrink-0 flex items-center justify-center p-2 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                              {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="max-w-full max-h-full object-contain" /> : <Monitor className="text-slate-200" size={24}/>}
                            </div>
                            <div className="flex-1 min-w-0 pt-1">
                              <p className="text-sm font-bold text-slate-900 line-clamp-2 leading-tight mb-2">{product.name}</p>
                              <div className="flex items-center gap-3">
                                <span className="text-[#ef4a23] font-black text-lg">৳{product.price.toLocaleString()}</span>
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">In Stock</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="h-16 border border-dashed border-slate-200 rounded-lg bg-slate-50 flex items-center justify-center">
                            <p className="text-xs text-slate-400 font-medium px-4 text-center">No <span className="lowercase">{comp.name}</span> selected yet</p>
                          </div>
                        )}
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="shrink-0 flex items-center gap-2 mt-4 md:mt-0 md:ml-4 w-full md:w-auto justify-end">
                        {product ? (
                          <>
                            <button onClick={() => setSelectingStep(comp.id)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors border border-slate-200/50">
                              <RefreshCw size={14} className="inline mr-1" /> Change
                            </button>
                            <button onClick={() => removeComponent(comp.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-100 hover:bg-red-50 border border-slate-200/50 hover:border-red-200 rounded-lg transition-colors">
                              <X size={18} />
                            </button>
                          </>
                        ) : (
                          <button onClick={() => setSelectingStep(comp.id)} className="w-full md:w-32 py-2.5 bg-[#081621] hover:bg-[#ef4a23] text-white text-xs font-black uppercase tracking-widest rounded-lg transition-colors shadow-sm">
                            Choose
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
          </div>

          {/* Sticky Summary Map (Right Col) */}
          <div className="lg:col-span-4 relative">
            <div className="sticky top-[100px] flex flex-col gap-6">
              
              <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
                <div className="bg-[#081621] p-6 text-white text-center">
                   <p className="text-xs font-bold text-white/50 uppercase tracking-[0.2em] mb-2">Total Estimated Price</p>
                   <h3 className="text-4xl font-black text-[#ef4a23] leading-none mb-4">
                     <span className="text-2xl mr-1">৳</span>{getTotal().toLocaleString()}
                   </h3>
                   
                   {/* Wattage Estimate */}
                   <div className="bg-white/10 rounded-xl p-3 flex flex-col items-center border border-white/5">
                      <div className="flex items-center gap-2 text-white/80 font-medium text-sm mb-2">
                        <Zap size={16} className="text-amber-400" /> Estimated Wattage
                      </div>
                      <p className="text-2xl font-black tracking-tight">{getEstimatedWattage()}<span className="text-sm font-bold text-white/50">W</span></p>
                   </div>
                </div>

                <div className="p-6">
                  {/* Progress completion bar */}
                  <div className="mb-6">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2">
                      <span className="text-slate-500">Core Build Status</span>
                      <span className={progressPercent === 100 ? "text-emerald-600" : "text-[#ef4a23]"}>{progressPercent}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: `${progressPercent}%` }}
                         className={cn("h-full rounded-full transition-colors duration-500", progressPercent === 100 ? "bg-emerald-500" : "bg-[#ef4a23]")}
                       />
                    </div>
                  </div>

                  <button 
                    onClick={handleCheckout}
                    disabled={getTotal() === 0}
                    className={cn(
                      "w-full py-4 rounded-xl flex items-center justify-center gap-2 font-black uppercase tracking-wider shadow-lg transition-all",
                      getTotal() === 0 
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                        : "bg-[#ef4a23] hover:bg-[#d8401e] text-white shadow-[#ef4a23]/30 hover:shadow-[#ef4a23]/50 hover:-translate-y-0.5"
                    )}
                  >
                    <ShoppingCart size={20} />
                    Check Out Build
                  </button>
                  
                  {progressPercent !== 100 && getTotal() > 0 && (
                    <p className="text-[10px] text-center mt-3 text-slate-400 font-medium">
                      Ensure you select all required components before checking out.
                    </p>
                  )}
                </div>
              </div>

              {/* Promo Banner Side */}
              <div className="bg-gradient-to-br from-slate-900 to-[#081621] rounded-2xl p-6 text-white border border-slate-800 shadow-lg relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-[#ef4a23]/20 blur-[50px] -mr-16 -mt-16 group-hover:bg-[#ef4a23]/40 transition-colors duration-500" />
                 <h4 className="font-black text-xl mb-2 relative z-10">Need Expert Assembly?</h4>
                 <p className="text-slate-400 text-sm mb-4 relative z-10">Our master technicians can build, wire-manage, and stress-test your custom rig.</p>
                 <button className="text-xs font-bold text-[#ef4a23] uppercase tracking-wider hover:text-white transition-colors relative z-10 flex items-center gap-1">
                   Learn about assembly <ChevronRight size={14} />
                 </button>
              </div>

            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
