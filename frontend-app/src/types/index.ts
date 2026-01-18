export interface StockItem {
  id: string;
  name: string;
  currentStock: number;
  unit: string; // gram, ml, pcs
  pricePerUnit: number;
  minStock: number;
  category: string;
}

export interface Ingredient {
  stockId: string;
  amount: number;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  ingredients: Ingredient[];
  image?: string;
}

export interface OrderItem {
  menuItem: MenuItem;
  quantity: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  cogs: number; // Cost of Goods Sold
  profit: number;
  timestamp: Date;
  paymentMethod: 'cash' | 'card' | 'qris';
}

export interface Employee {
  id: string;
  name: string;
  position: string;
  baseSalary: number;
  bonus: number;
}

export interface DailySummary {
  date: string;
  totalSales: number;
  totalCogs: number;
  grossProfit: number;
  totalOrders: number;
}
