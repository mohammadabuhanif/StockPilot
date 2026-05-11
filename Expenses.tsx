import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Product, Sale, ServiceOrder, Expense, Customer, RepairJob } from '../types';
import { TrendingUp, DollarSign, Package, ShoppingBag, ArrowUpRight, ArrowDownRight, Zap, Clock, Users, TrendingDown, Wrench, Printer } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { format, startOfDay, subDays, isSameDay } from 'date-fns';
import { cn, formatAppTime, formatAppDateTime } from '../lib/utils';
import gsap from 'gsap';

interface DashboardProps {
  products: Product[];
  sales: Sale[];
  serviceOrders: ServiceOrder[];
  expenses: Expense[];
  customers: Customer[];
  repairJobs: RepairJob[];
}

export default function Dashboard({ products, sales, serviceOrders, expenses, customers, repairJobs }: DashboardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Delay mounting to ensure layout is stable
    const timer = setTimeout(() => setMounted(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (mounted && containerRef.current) {
      const cards = containerRef.current.querySelectorAll('.stat-card');
      const charts = containerRef.current.querySelectorAll('.chart-container');
      
      if (cards.length > 0 || charts.length > 0) {
        const tl = gsap.timeline();
        if (cards.length > 0) {
          tl.fromTo(cards, 
            { opacity: 0, y: 20, scale: 0.95 }, 
            { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.1, ease: 'back.out(1.7)' }
          );
        }
        if (charts.length > 0) {
          tl.fromTo(charts,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.6, stagger: 0.2, ease: 'power2.out' },
            cards.length > 0 ? "-=0.3" : 0
          );
        }
      }
    }
  }, [mounted]);

  const stats = useMemo(() => {
    const totalSalesRevenue = sales.reduce((sum, s) => sum + s.totalPrice, 0);
    const totalSalesProfit = sales.reduce((sum, s) => sum + s.totalProfit, 0);
    
    const totalRepairRevenue = repairJobs.reduce((sum, j) => sum + (j.finalCost || 0), 0);
    const totalRepairProfit = repairJobs.reduce((sum, j) => sum + (j.earnings || 0), 0);

    const totalServiceRevenue = serviceOrders.reduce((sum, o) => sum + (o.price || 0), 0);
    // For service orders, we assume profit is the full price (labor/service) unless we have a cost model
    const totalServiceProfit = totalServiceRevenue; 

    const totalRevenue = totalSalesRevenue + totalRepairRevenue + totalServiceRevenue;
    const totalProfit = totalSalesProfit + totalRepairProfit + totalServiceProfit;
    
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalProfit - totalExpenses;
    const lowStockCount = products.filter(p => p.stock <= p.minStock).length;
    const totalProducts = products.length;
    const totalCustomers = customers.length;

    // Products added today
    const productsAddedToday = products.filter(p => p.createdAt && isSameDay(p.createdAt.toDate(), new Date())).length;

    // Last 7 days revenue & product growth
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), i);
      const daySales = sales.filter(s => s.timestamp && isSameDay(s.timestamp.toDate(), date));
      const dayRepairs = repairJobs.filter(j => j.createdAt && isSameDay(j.createdAt.toDate(), date));
      const dayServices = serviceOrders.filter(o => o.createdAt && isSameDay(o.createdAt.toDate(), date));
      const dayProducts = products.filter(p => p.createdAt && isSameDay(p.createdAt.toDate(), date));
      
      const salesRev = daySales.reduce((sum, s) => sum + s.totalPrice, 0);
      const repairRev = dayRepairs.reduce((sum, j) => sum + (j.finalCost || 0), 0);
      const serviceRev = dayServices.reduce((sum, o) => sum + (o.price || 0), 0);

      return {
        date: format(date, 'MMM dd'),
        revenue: salesRev + repairRev + serviceRev,
        salesRevenue: salesRev,
        repairRevenue: repairRev,
        serviceRevenue: serviceRev,
        profit: daySales.reduce((sum, s) => sum + s.totalProfit, 0) + 
                dayRepairs.reduce((sum, j) => sum + (j.earnings || 0), 0) +
                serviceRev,
        newProducts: dayProducts.length,
      };
    }).reverse();

    // Service Center Specific Stats (Printing etc)
    const serviceStats = {
      daily: serviceOrders.filter(o => o.createdAt && isSameDay(o.createdAt.toDate(), new Date())).reduce((sum, o) => sum + (o.price || 0), 0),
      weekly: serviceOrders.filter(o => o.createdAt && o.createdAt.toDate() > subDays(new Date(), 7)).reduce((sum, o) => sum + (o.price || 0), 0),
      monthly: serviceOrders.filter(o => o.createdAt && o.createdAt.toDate() > subDays(new Date(), 30)).reduce((sum, o) => sum + (o.price || 0), 0),
      total: totalServiceRevenue
    };

    // Repair Specific Stats
    const repairStats = {
      daily: repairJobs.filter(j => j.createdAt && isSameDay(j.createdAt.toDate(), new Date())).reduce((sum, j) => sum + (j.finalCost || 0), 0),
      weekly: repairJobs.filter(j => j.createdAt && j.createdAt.toDate() > subDays(new Date(), 7)).reduce((sum, j) => sum + (j.finalCost || 0), 0),
      monthly: repairJobs.filter(j => j.createdAt && j.createdAt.toDate() > subDays(new Date(), 30)).reduce((sum, j) => sum + (j.finalCost || 0), 0),
      total: totalRepairRevenue,
      profit: totalRepairProfit
    };

    // Top products
    const productSalesMap: Record<string, number> = {};
    sales.forEach(s => {
      productSalesMap[s.productName] = (productSalesMap[s.productName] || 0) + s.quantity;
    });
    const topProducts = Object.entries(productSalesMap)
      .map(([name, sales]) => ({ name, sales }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);

    const featuredProducts = products.filter(p => p.isFeatured).slice(0, 4);

    const pendingOrders = serviceOrders.filter(o => o.status === 'pending' || o.status === 'processing');
    const completedOrdersToday = serviceOrders.filter(o => o.status === 'completed' && isSameDay(o.updatedAt.toDate(), new Date())).length;

    const topCustomers = [...customers].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 4);

    return { totalRevenue, totalProfit, totalExpenses, netProfit, lowStockCount, totalProducts, totalCustomers, productsAddedToday, last7Days, topProducts, featuredProducts, pendingOrders, completedOrdersToday, topCustomers, repairStats, serviceStats };
  }, [products, sales, serviceOrders, expenses, customers, repairJobs]);

  return (
    <div className="space-y-4" ref={containerRef}>
      {/* Top Section: Stats & Revenue */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Stats 2x2 Grid */}
        <div className="grid grid-cols-2 gap-3 h-fit">
          <StatCard
            title="Revenue"
            value={`৳${stats.totalRevenue.toLocaleString()}`}
            icon={<DollarSign className="text-emerald-600" size={16} />}
            trend="+12.5%"
            trendUp={true}
            color="emerald"
          />
          <StatCard
            title="Profit"
            value={`৳${stats.totalProfit.toLocaleString()}`}
            icon={<TrendingUp className="text-indigo-600" size={16} />}
            trend="+8.2%"
            trendUp={true}
            color="indigo"
          />
          <StatCard
            title="Expenses"
            value={`৳${stats.totalExpenses.toLocaleString()}`}
            icon={<TrendingDown className="text-red-600" size={16} />}
            trend="Monthly"
            trendUp={false}
            color="red"
          />
          <StatCard
            title="Net Profit"
            value={`৳${stats.netProfit.toLocaleString()}`}
            icon={<DollarSign className="text-emerald-600" size={16} />}
            trend="After Costs"
            trendUp={stats.netProfit > 0}
            color="emerald"
          />
          <StatCard
            title="Customers"
            value={stats.totalCustomers.toString()}
            icon={<Users className="text-blue-600" size={16} />}
            trend="Regulars"
            trendUp={true}
            color="blue"
          />
          <StatCard
            title="Products"
            value={stats.totalProducts.toString()}
            icon={<Package className="text-slate-600" size={16} />}
            trend={`+${stats.productsAddedToday} today`}
            trendUp={stats.productsAddedToday > 0}
            color="slate"
          />
          <StatCard
            title="Low Stock"
            value={stats.lowStockCount.toString()}
            icon={<ShoppingBag className="text-amber-600" size={16} />}
            trend={stats.lowStockCount > 0 ? "Alert" : "Safe"}
            trendUp={stats.lowStockCount === 0}
            color="amber"
          />
          <StatCard
            title="Pending Services"
            value={stats.pendingOrders.length.toString()}
            icon={<Zap className="text-indigo-600" size={16} />}
            trend={`${stats.completedOrdersToday} done today`}
            trendUp={stats.completedOrdersToday > 0}
            color="indigo"
          />
          <StatCard
            title="Service Income"
            value={`৳${(stats.serviceStats.total + stats.repairStats.total).toLocaleString()}`}
            icon={<Zap className="text-blue-600" size={16} />}
            trend={`৳${stats.serviceStats.daily + stats.repairStats.daily} today`}
            trendUp={(stats.serviceStats.daily + stats.repairStats.daily) > 0}
            color="blue"
          />
        </div>

        {/* Revenue Chart */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm chart-container min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Business Growth</h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Revenue</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">New Items</span>
              </div>
            </div>
          </div>
          <div className="w-full h-[150px] sm:h-[200px]">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <AreaChart data={stats.last7Days}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorProducts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} dy={5} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} tickFormatter={(v) => `৳${v}`} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                  />
                  <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" name="Total Revenue" />
                  <Area yAxisId="left" type="monotone" dataKey="serviceRevenue" stroke="#0ea5e9" strokeWidth={1} fillOpacity={0.5} fill="url(#colorRevenue)" name="Printing/Service" />
                  <Area yAxisId="left" type="monotone" dataKey="repairRevenue" stroke="#8b5cf6" strokeWidth={1} fillOpacity={0.3} fill="url(#colorRevenue)" name="Repair Revenue" />
                  <Area yAxisId="right" type="monotone" dataKey="newProducts" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProducts)" name="New Products" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Top Products, Featured, Low Stock, Service Orders */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Top Products */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm chart-container min-w-0">
          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3">Top Selling</h3>
          <div className="w-full h-[140px]">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <BarChart data={stats.topProducts} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} width={80} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                  />
                  <Bar dataKey="sales" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Service Orders Summary */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm chart-container">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Active Services</h3>
            <span className="text-[8px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">Pending</span>
          </div>
          <div className="space-y-2">
            {stats.pendingOrders.slice(0, 4).map(order => (
              <div key={order.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    "p-1.5 rounded-lg shrink-0",
                    order.status === 'pending' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                  )}>
                    <Clock size={12} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-900 dark:text-white truncate">{order.customerName}</p>
                    <p className="text-[9px] text-slate-500 dark:text-slate-400 truncate">{order.serviceName}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">৳{order.price}</p>
                </div>
              </div>
            ))}
            {stats.pendingOrders.length === 0 && (
              <div className="py-6 text-center text-slate-400 dark:text-slate-500 italic text-[10px]">
                No active service orders.
              </div>
            )}
          </div>
        </div>

        {/* Featured Products */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm chart-container">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Featured</h3>
            <span className="text-[8px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">Live</span>
          </div>
          <div className="space-y-2">
            {stats.featuredProducts.map(product => (
              <div key={product.id} className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-colors group">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800 flex-shrink-0">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
                      <Package size={16} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-[11px] text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{product.name}</h4>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[10px] font-black text-slate-900 dark:text-white">৳{product.price}</span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400">{product.category}</span>
                  </div>
                </div>
              </div>
            ))}
            {stats.featuredProducts.length === 0 && (
              <div className="py-6 text-center text-slate-400 dark:text-slate-500 italic text-[10px]">
                No products featured.
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm chart-container">
          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3">Alerts</h3>
          <div className="space-y-2">
            {products.filter(p => p.stock <= p.minStock).slice(0, 4).map(product => (
              <div key={product.id} className="flex items-center justify-between p-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="bg-white dark:bg-slate-900 p-1 rounded-lg text-amber-600 dark:text-amber-500 shadow-sm shrink-0">
                    <Package size={12} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-900 dark:text-white truncate">{product.name}</p>
                    <p className="text-[9px] text-amber-700 dark:text-amber-500 font-medium">{product.stock} units left</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[8px] font-bold text-amber-800 dark:text-amber-600 uppercase tracking-wider">Min: {product.minStock}</p>
                </div>
              </div>
            ))}
            {products.filter(p => p.stock <= p.minStock).length === 0 && (
              <div className="py-6 text-center text-slate-400 dark:text-slate-500 italic text-[10px]">
                Stock levels healthy!
              </div>
            )}
          </div>
        </div>

        {/* Top Customers */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm chart-container">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Top Customers</h3>
            <Users size={14} className="text-indigo-500" />
          </div>
          <div className="space-y-2">
            {stats.topCustomers.map(customer => (
              <div key={customer.id} className="flex items-center justify-between p-2 rounded-xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-800/30">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-indigo-500 shadow-sm shrink-0">
                    <Users size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-900 dark:text-white truncate">{customer.name}</p>
                    <p className="text-[8px] text-slate-500 dark:text-slate-400 truncate">{customer.phone}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">৳{customer.totalSpent.toLocaleString()}</p>
                  <p className="text-[8px] font-bold text-amber-500 uppercase tracking-widest">{customer.loyaltyPoints} pts</p>
                </div>
              </div>
            ))}
            {stats.topCustomers.length === 0 && (
              <div className="py-6 text-center text-slate-400 dark:text-slate-500 italic text-[10px]">
                No customer records yet.
              </div>
            )}
          </div>
        </div>

        {/* Service Center Breakdown (Printing etc) */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm chart-container">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Printing & Services</h3>
            <Printer size={14} className="text-indigo-500" />
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl border border-indigo-100 dark:border-indigo-500/20">
              <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Today's Income</p>
              <h4 className="text-xl font-black text-slate-900 dark:text-white">৳{stats.serviceStats.daily.toLocaleString()}</h4>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Weekly</p>
                <p className="text-xs font-black text-slate-900 dark:text-white">৳{stats.serviceStats.weekly.toLocaleString()}</p>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Monthly</p>
                <p className="text-xs font-black text-slate-900 dark:text-white">৳{stats.serviceStats.monthly.toLocaleString()}</p>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Revenue</p>
                <p className="text-sm font-black text-emerald-600">৳{stats.serviceStats.total.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Repair Center Breakdown */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm chart-container">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Repair Income</h3>
            <Wrench size={14} className="text-blue-500" />
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-2xl border border-blue-100 dark:border-blue-500/20">
              <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Today's Income</p>
              <h4 className="text-xl font-black text-slate-900 dark:text-white">৳{stats.repairStats.daily.toLocaleString()}</h4>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Weekly</p>
                <p className="text-xs font-black text-slate-900 dark:text-white">৳{stats.repairStats.weekly.toLocaleString()}</p>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Monthly</p>
                <p className="text-xs font-black text-slate-900 dark:text-white">৳{stats.repairStats.monthly.toLocaleString()}</p>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Earnings</p>
                <p className="text-sm font-black text-emerald-600">৳{stats.repairStats.profit.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend, trendUp, color }: { title: string, value: string, icon: React.ReactNode, trend: string, trendUp: boolean, color: string }) {
  const colorClasses: Record<string, string> = {
    emerald: "bg-emerald-50 dark:bg-emerald-500/10",
    indigo: "bg-indigo-50 dark:bg-indigo-500/10",
    blue: "bg-blue-50 dark:bg-blue-500/10",
    amber: "bg-amber-50 dark:bg-amber-500/10",
    red: "bg-red-50 dark:bg-red-500/10",
    slate: "bg-slate-50 dark:bg-slate-800",
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 stat-card hover:-translate-y-0.5">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${colorClasses[color]} shrink-0 flex items-center justify-center`}>
          {React.cloneElement(icon as any, { size: 18 })}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 truncate uppercase tracking-[0.1em]">{title}</p>
          <h4 className="text-base font-black text-slate-900 dark:text-white truncate tracking-tight">{value}</h4>
          <div className={`flex items-center gap-0.5 text-[9px] font-bold ${trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {trendUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {trend}
          </div>
        </div>
      </div>
    </div>
  );
}

