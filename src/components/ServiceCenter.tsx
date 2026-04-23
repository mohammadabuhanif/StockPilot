import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, Timestamp, onSnapshot, query, orderBy, handleFirestoreError, OperationType, auth } from '../firebase';
import { Service, ServiceOrder, Settings } from '../types';
import { Plus, Search, Filter, Clock, CheckCircle2, Truck, AlertCircle, Phone, User, FileText, Printer, MoreVertical, Trash2, Edit2, TrendingUp, DollarSign, AlertTriangle } from 'lucide-react';
import { format, isSameDay, subDays } from 'date-fns';
import { cn, formatAppTime, formatAppDateTime } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { CashDrawerBox } from './CashDrawerBox';
import { MobileFinancialServices } from './MobileFinancialServices';

export default function ServiceCenter({ settings }: { settings: Settings | null }) {
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [isAddingService, setIsAddingService] = useState(false);
  const [isAddingOrder, setIsAddingOrder] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'catalog' | 'mfs'>('orders');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [orderSortBy, setOrderSortBy] = useState<'newest' | 'oldest' | 'price-high' | 'price-low' | 'customer'>('newest');
  const [catalogSortBy, setCatalogSortBy] = useState<'name' | 'price-high' | 'price-low'>('name');
  const [deletingOrder, setDeletingOrder] = useState<ServiceOrder | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showPrintMessage, setShowPrintMessage] = useState(false);

  // New Service Form State
  const [newService, setNewService] = useState<{
    name: string;
    category: 'printing' | 'document' | 'other';
    basePrice: number;
    description: string;
  }>({
    name: '',
    category: 'printing',
    basePrice: 0,
    description: ''
  });

  // New Order Form State
  const [newOrder, setNewOrder] = useState({
    serviceId: '',
    customerName: '',
    customerPhone: '',
    price: 0,
    notes: ''
  });

  useEffect(() => {
    const servicesUnsubscribe = onSnapshot(collection(db, 'services'), (snapshot) => {
      const servicesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
      setServices(servicesData);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'services'));

    const ordersUnsubscribe = onSnapshot(query(collection(db, 'serviceOrders'), orderBy('createdAt', 'desc')), (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceOrder));
      setOrders(ordersData);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'serviceOrders'));

    return () => {
      servicesUnsubscribe();
      ordersUnsubscribe();
    };
  }, []);

  const incomeStats = {
    daily: orders.filter(o => o.createdAt && isSameDay(o.createdAt.toDate(), new Date())).reduce((sum, o) => sum + (o.price || 0), 0),
    weekly: orders.filter(o => o.createdAt && o.createdAt.toDate() > subDays(new Date(), 7)).reduce((sum, o) => sum + (o.price || 0), 0),
    monthly: orders.filter(o => o.createdAt && o.createdAt.toDate() > subDays(new Date(), 30)).reduce((sum, o) => sum + (o.price || 0), 0),
    total: orders.reduce((sum, o) => sum + (o.price || 0), 0)
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingService) {
        await updateDoc(doc(db, 'services', editingService.id), newService);
      } else {
        await addDoc(collection(db, 'services'), newService);
      }
      setNewService({ name: '', category: 'printing', basePrice: 0, description: '' });
      setIsAddingService(false);
      setEditingService(null);
    } catch (err) {
      handleFirestoreError(err, editingService ? OperationType.UPDATE : OperationType.CREATE, 'services');
    }
  };

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const service = services.find(s => s.id === newOrder.serviceId);
    if (!service) return;

    try {
      const orderData = {
        ...newOrder,
        serviceName: service.name,
        status: 'pending' as const,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      await addDoc(collection(db, 'serviceOrders'), orderData);
      setNewOrder({ serviceId: '', customerName: '', customerPhone: '', price: 0, notes: '' });
      setIsAddingOrder(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'serviceOrders');
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: ServiceOrder['status']) => {
    try {
      await updateDoc(doc(db, 'serviceOrders', orderId), {
        status: newStatus,
        updatedAt: Timestamp.now()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'serviceOrders');
    }
  };

  const updateOrderPrice = async (orderId: string, newPrice: number) => {
    try {
      await updateDoc(doc(db, 'serviceOrders', orderId), {
        price: newPrice,
        updatedAt: Timestamp.now()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'serviceOrders');
    }
  };

  const deleteOrder = async (orderId: string) => {
    try {
      await deleteDoc(doc(db, 'serviceOrders', orderId));
      setDeletingOrder(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'serviceOrders');
    }
  };

  const handlePrintOrder = (order: ServiceOrder) => {
    setShowPrintMessage(true);
    setTimeout(() => setShowPrintMessage(false), 5000);

    const logoUrl = "https://i.ibb.co/cX7qP4n6/Picsart-26-04-10-02-09-25-057.png";
    const timestamp = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();

    const memoHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Service Receipt - ${settings?.shopName || 'Digital Shop'}</title>
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
            .memo-title { font-size: 16px; font-weight: 700; margin-top: 10px; text-decoration: underline; }
            .details { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 10px; }
            .info-box { font-size: 10px; margin-bottom: 15px; padding: 6px; border: 1px solid #000; }
            .item-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 11px; }
            .total-section { border-top: 2px dashed #000; padding-top: 10px; margin-top: 10px; }
            .footer { text-align: center; margin-top: 30px; font-size: 10px; font-style: italic; border-top: 1px dashed #eee; padding-top: 10px; }
            @media print {
              body { padding: 0; margin: 0; width: 80mm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logoUrl}" alt="Logo" class="logo" referrerPolicy="no-referrer" />
            <h1 style="margin: 5px 0; font-size: 18px;">${settings?.shopName || 'DIGITAL SHOP'}</h1>
            ${settings?.shopAddress ? `<p style="font-size: 10px; margin: 2px 0;">${settings.shopAddress}</p>` : ''}
            <div class="memo-title">SERVICE RECEIPT</div>
          </div>

          <div class="details">
            <span>Date: ${format(timestamp, 'yyyy-MM-dd')}</span>
            <span>ID: ${order.id.substring(0, 8).toUpperCase()}</span>
          </div>

          <div class="info-box">
            <strong>CUSTOMER:</strong> ${order.customerName.toUpperCase()}<br>
            <strong>PHONE:</strong> ${order.customerPhone}
          </div>

          <div class="item-row" style="font-weight: 700; border-bottom: 1px solid #000; padding-bottom: 4px;">
            <span>SERVICE</span>
            <span>PRICE</span>
          </div>
          <div class="item-row" style="padding-top: 4px;">
            <span>${order.serviceName.toUpperCase()}</span>
            <span>৳${(order.price || 0).toFixed(2)}</span>
          </div>
          ${order.notes ? `<p style="font-size: 9px; margin-top: 4px; font-style: italic;">Note: ${order.notes}</p>` : ''}

          <div class="total-section">
            <div class="item-row" style="font-weight: 700; font-size: 14px;">
              <span>TOTAL PAID:</span>
              <span>৳${(order.price || 0).toFixed(2)}</span>
            </div>
            <div class="item-row" style="margin-top: 5px; font-size: 9px;">
              <span>STATUS:</span>
              <span>${order.status.toUpperCase()}</span>
            </div>
          </div>

          <div class="footer">
            ${settings?.memoFooter || 'Thank you for choosing our services!'}
            <p style="margin-top: 10px; font-size: 8px; opacity: 0.5;">Powered by StockPilot</p>
          </div>

          <script>
            window.onload = function() {
              setTimeout(() => { window.print(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    
    let printDiv = document.querySelector('.temp-print-container') as HTMLDivElement;
    if (!printDiv) {
      printDiv = document.createElement('div');
      printDiv.className = 'global-print-container temp-print-container';
      
      document.body.appendChild(printDiv);
    }
    // Extract body and style from the html string
    const styleMatch = memoHtml ? memoHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i) : null;
    const bodyMatch = memoHtml ? memoHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i) : null;
    
    const styleString = styleMatch ? "<style>" + styleMatch[1] + "</style>" : '';
    const bodyString = bodyMatch ? bodyMatch[1] : memoHtml;

    printDiv.innerHTML = styleString + '<div style="background:white; color:black; width:100%; height:100%;">' + bodyString + '</div>';
    
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        if (printDiv) printDiv.innerHTML = '';
      }, 500);
    }, 100);
  
  };

  const filteredOrders = orders.filter(order => {
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesSearch = order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          order.customerPhone.includes(searchTerm) ||
                          order.serviceName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  }).sort((a, b) => {
    switch (orderSortBy) {
      case 'newest': return b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime();
      case 'oldest': return a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime();
      case 'price-high': return b.price - a.price;
      case 'price-low': return a.price - b.price;
      case 'customer': return a.customerName.localeCompare(b.customerName);
      default: return 0;
    }
  });

  const sortedServices = [...services].sort((a, b) => {
    switch (catalogSortBy) {
      case 'name': return a.name.localeCompare(b.name);
      case 'price-high': return b.basePrice - a.basePrice;
      case 'price-low': return a.basePrice - b.basePrice;
      default: return 0;
    }
  });

  const getStatusIcon = (status: ServiceOrder['status']) => {
    switch (status) {
      case 'pending': return <Clock className="text-amber-500" size={16} />;
      case 'processing': return <AlertCircle className="text-blue-500" size={16} />;
      case 'completed': return <CheckCircle2 className="text-emerald-500" size={16} />;
      case 'delivered': return <Truck className="text-slate-500" size={16} />;
    }
  };

  const getStatusColor = (status: ServiceOrder['status']) => {
    switch (status) {
      case 'pending': return "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-500 dark:border-amber-500/20";
      case 'processing': return "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-500 dark:border-blue-500/20";
      case 'completed': return "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-500 dark:border-emerald-500/20";
      case 'delivered': return "bg-slate-50 text-slate-700 border-slate-100 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('orders')}
              className={cn(
                "flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                activeTab === 'orders' ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500"
              )}
            >
              Service Orders
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={cn(
                "flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                activeTab === 'catalog' ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500"
              )}
            >
              Service Catalog
            </button>
            <button
              onClick={() => setActiveTab('mfs')}
              className={cn(
                "flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                activeTab === 'mfs' ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500"
              )}
            >
              MFS & Recharge
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="p-1.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <DollarSign size={16} />
              </div>
              <div>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Today</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">৳{incomeStats.daily.toLocaleString()}</p>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="p-1.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg">
                <TrendingUp size={16} />
              </div>
              <div>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Weekly</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">৳{incomeStats.weekly.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
        
        {activeTab !== 'mfs' && (
          <button
            onClick={() => {
              if (activeTab === 'orders') {
                setIsAddingOrder(true);
              } else {
                setEditingService(null);
                setNewService({ name: '', category: 'printing', basePrice: 0, description: '' });
                setIsAddingService(true);
              }
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95"
          >
            <Plus size={20} />
            {activeTab === 'orders' ? 'New Order' : 'Add Service'}
          </button>
        )}
      </div>

      {activeTab === 'orders' && (
        <CashDrawerBox registerId="service" registerName="Service Center Register" />
      )}

      {activeTab === 'mfs' ? (
        <MobileFinancialServices />
      ) : activeTab === 'orders' ? (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search customer, phone or service..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
              />
            </div>
            
            <div className="relative shrink-0">
              <select
                value={orderSortBy}
                onChange={(e) => setOrderSortBy(e.target.value as any)}
                className="appearance-none pl-10 pr-8 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white text-sm font-bold cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="price-high">Price (High-Low)</option>
                <option value="price-low">Price (Low-High)</option>
                <option value="customer">Customer Name</option>
              </select>
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
              {['all', 'pending', 'processing', 'completed', 'delivered'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap",
                    filterStatus === status 
                      ? "bg-indigo-600 border-indigo-600 text-white" 
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-200"
                  )}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredOrders.map(order => (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={cn("px-3 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1.5 uppercase tracking-wider", getStatusColor(order.status))}>
                      {getStatusIcon(order.status)}
                      {order.status}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handlePrintOrder(order)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg" title="Print Receipt"><Printer size={14} /></button>
                      <button onClick={() => setDeletingOrder(order)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"><Trash2 size={14} /></button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h4 className="font-black text-slate-900 dark:text-white text-lg leading-tight">{order.serviceName}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                        <Clock size={12} />
                        {formatAppDateTime(order.createdAt.toDate())}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-50 dark:border-slate-800">
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Customer</p>
                        <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-300">
                          <User size={14} className="text-indigo-500" />
                          {order.customerName}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Phone</p>
                        <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-300">
                          <Phone size={14} className="text-emerald-500" />
                          {order.customerPhone}
                        </div>
                      </div>
                    </div>

                    {order.notes && (
                      <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs text-slate-600 dark:text-slate-400 italic">
                        "{order.notes}"
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-400">৳</span>
                        <input 
                          type="number"
                          value={order.price}
                          onChange={(e) => updateOrderPrice(order.id, Number(e.target.value))}
                          className="w-20 bg-slate-50 dark:bg-slate-800/50 rounded px-2 py-1 text-lg font-black text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500 outline-none transition-all border border-slate-100 dark:border-slate-800"
                          title="Negotiated Price"
                        />
                      </div>
                      <div className="flex gap-1">
                        {order.status === 'pending' && (
                          <button onClick={() => updateOrderStatus(order.id, 'processing')} className="px-3 py-1.5 bg-blue-500 text-white text-[10px] font-bold rounded-lg hover:bg-blue-600 transition-all">Start Processing</button>
                        )}
                        {order.status === 'processing' && (
                          <button onClick={() => updateOrderStatus(order.id, 'completed')} className="px-3 py-1.5 bg-emerald-500 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-600 transition-all">Mark Completed</button>
                        )}
                        {order.status === 'completed' && (
                          <button onClick={() => updateOrderStatus(order.id, 'delivered')} className="px-3 py-1.5 bg-slate-600 text-white text-[10px] font-bold rounded-lg hover:bg-slate-700 transition-all">Mark Delivered</button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {filteredOrders.length === 0 && (
            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-full w-fit mx-auto mb-4">
                <FileText size={48} className="text-slate-300 dark:text-slate-700" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">No orders found</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Try adjusting your filters or create a new order.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <div className="relative shrink-0 w-full sm:w-64">
              <select
                value={catalogSortBy}
                onChange={(e) => setCatalogSortBy(e.target.value as any)}
                className="w-full appearance-none pl-10 pr-8 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white text-sm font-bold cursor-pointer"
              >
                <option value="name">Sort by Name</option>
                <option value="price-high">Price (High-Low)</option>
                <option value="price-low">Price (Low-High)</option>
              </select>
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedServices.map(service => (
              <div key={service.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-indigo-200 transition-all group">
                <div className="flex justify-between items-start mb-3">
                  <div className={cn(
                    "p-2 rounded-xl",
                    service.category === 'printing' ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" :
                    service.category === 'document' ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" :
                    "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                  )}>
                    {service.category === 'printing' ? <Printer size={20} /> : <FileText size={20} />}
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="text-lg font-black text-indigo-600 dark:text-indigo-400">৳{service.basePrice}</div>
                    <button 
                      onClick={() => {
                        setEditingService(service);
                        setNewService({
                          name: service.name,
                          category: service.category,
                          basePrice: service.basePrice,
                          description: service.description || ''
                        });
                        setIsAddingService(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-all mt-1"
                      title="Edit Service"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">{service.name}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">{service.description || 'No description provided.'}</p>
                <button 
                  onClick={() => {
                    setNewOrder({ ...newOrder, serviceId: service.id, price: service.basePrice });
                    setIsAddingOrder(true);
                  }}
                  className="w-full py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl hover:bg-indigo-600 hover:text-white transition-all"
                >
                  Create Order
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Order Modal */}
      <AnimatePresence>
        {isAddingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">New Service Order</h3>
                <button onClick={() => setIsAddingOrder(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                  <Plus size={20} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleAddOrder} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Service</label>
                  <select
                    required
                    value={newOrder.serviceId}
                    onChange={(e) => {
                      const s = services.find(sv => sv.id === e.target.value);
                      setNewOrder({ ...newOrder, serviceId: e.target.value, price: s?.basePrice || 0 });
                    }}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  >
                    <option value="">Select a service...</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name} (৳{s.basePrice})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer Name</label>
                    <input
                      required
                      type="text"
                      value={newOrder.customerName}
                      onChange={(e) => setNewOrder({ ...newOrder, customerName: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone</label>
                    <input
                      required
                      type="tel"
                      value={newOrder.customerPhone}
                      onChange={(e) => setNewOrder({ ...newOrder, customerPhone: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      placeholder="017..."
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Agreed Price (৳)</label>
                  <input
                    required
                    type="number"
                    value={newOrder.price}
                    onChange={(e) => setNewOrder({ ...newOrder, price: Number(e.target.value) })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Notes</label>
                  <textarea
                    value={newOrder.notes}
                    onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white h-24 resize-none"
                    placeholder="Specific requirements..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none transition-all active:scale-95 mt-4"
                >
                  Create Order
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Service Modal */}
      <AnimatePresence>
        {isAddingService && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">{editingService ? 'Edit Service' : 'Add New Service'}</h3>
                <button 
                  onClick={() => {
                    setIsAddingService(false);
                    setEditingService(null);
                    setNewService({ name: '', category: 'printing', basePrice: 0, description: '' });
                  }} 
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <Plus size={20} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleAddService} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Service Name</label>
                  <input
                    required
                    type="text"
                    value={newService.name}
                    onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    placeholder="e.g. Passport Size Photo"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</label>
                    <select
                      value={newService.category}
                      onChange={(e) => setNewService({ ...newService, category: e.target.value as any })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    >
                      <option value="printing">Printing</option>
                      <option value="document">Document</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Base Price (৳)</label>
                    <input
                      required
                      type="number"
                      value={newService.basePrice}
                      onChange={(e) => setNewService({ ...newService, basePrice: Number(e.target.value) })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</label>
                  <textarea
                    value={newService.description}
                    onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white h-24 resize-none"
                    placeholder="Service details..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none transition-all active:scale-95 mt-4"
                >
                  {editingService ? 'Update Service' : 'Add Service'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Modals & Popups */}
      <AnimatePresence>
        {showPrintMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 border border-slate-800 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[320px]"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <Printer className="text-indigo-400 animate-pulse" size={20} />
            </div>
            <div>
              <p className="font-bold text-sm">Preparing Memo...</p>
              <p className="text-[10px] text-slate-400">Your print dialog will open shortly.</p>
            </div>
            <div className="ml-auto w-1 h-10 bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ height: "0%" }}
                animate={{ height: "100%" }}
                transition={{ duration: 5 }}
                className="w-full bg-indigo-500"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingOrder && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingOrder(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} className="text-red-600" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Delete Order?</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8">
                Are you sure you want to delete the service order for <span className="font-bold text-slate-900 dark:text-white">"{deletingOrder.customerName}"</span>? This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setDeletingOrder(null)}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteOrder(deletingOrder.id)}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
