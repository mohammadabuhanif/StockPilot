import { Timestamp } from './firebase';

export interface StockLog {
  id: string;
  type: 'addition' | 'sale' | 'adjustment' | 'replacement' | 'issue';
  amount: number;
  previousStock: number;
  newStock: number;
  timestamp: Timestamp;
  note?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  brand?: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  imageUrl?: string;
  description?: string;
  notes?: string;
  isFeatured?: boolean;
  barcode?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  totalProfit: number;
  timestamp: Timestamp;
}

export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  color?: string;
  style?: string;
  fontSize?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Idea {
  id: string;
  userId: string;
  content: string;
  source: 'ai' | 'user';
  createdAt: Timestamp;
}

export interface Service {
  id: string;
  name: string;
  category: 'printing' | 'document' | 'other';
  basePrice: number;
  description?: string;
}

export interface ServiceOrder {
  id: string;
  serviceId: string;
  serviceName: string;
  customerName: string;
  customerPhone: string;
  status: 'pending' | 'processing' | 'completed' | 'delivered';
  price: number;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Expense {
  id: string;
  title: string;
  category: 'rent' | 'utilities' | 'supplies' | 'marketing' | 'other';
  amount: number;
  date: Timestamp;
  note?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  totalSpent: number;
  loyaltyPoints: number;
  notes?: string;
  createdAt: Timestamp;
  lastVisit: Timestamp;
}

export interface DashboardStats {
  totalSales: number;
  totalProfit: number;
  totalExpenses: number;
  netProfit: number;
  lowStockCount: number;
  topSellingProducts: { name: string; sales: number }[];
}

export interface Settings {
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  shopEmail?: string;
  memoFooter?: string;
}

export type UserRole = 'admin' | 'fixer' | 'staff';

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
  photoURL?: string;
  pin?: string;
}

export interface RepairJob {
  id: string;
  fixerId: string;
  customerName: string;
  customerPhone: string;
  deviceModel: string;
  issueDescription: string;
  status: 'pending' | 'diagnosing' | 'waiting_parts' | 'repairing' | 'ready' | 'delivered' | 'cancelled';
  estimatedCost: number;
  finalCost: number;
  partsCost: number;
  laborCost: number;
  earnings: number;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MFSTransaction {
  id: string;
  provider: 'bkash' | 'nagad' | 'rocket' | 'recharge' | 'other';
  type: 'cash_in' | 'cash_out' | 'send_money' | 'recharge';
  amount: number;
  commission: number;
  customerPhone: string;
  notes?: string;
  createdAt: Timestamp;
}

export interface CashRegisterSession {
  id: string;
  registerId: 'sales' | 'service' | 'fixer' | 'mfs';
  date: string; // YYYY-MM-DD
  status: 'open' | 'closed';
  openedAt: Timestamp;
  openedBy: string;
  openingBalance: number;
  closedAt?: Timestamp;
  closedBy?: string;
  closingBalance?: number; // Actual physical cash counted
  expectedBalance?: number; // System calculated cash
  discrepancy?: number; // closingBalance - expectedBalance
  closingImageUrl?: string; // Photo proof
  notes?: string;
}
