import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StockItem, MenuItem, Order, Employee } from '@/types';

interface AppState {
  // Stock
  stocks: StockItem[];
  addStock: (stock: StockItem) => void;
  updateStock: (id: string, stock: Partial<StockItem>) => void;
  deleteStock: (id: string) => void;
  reduceStock: (stockId: string, amount: number) => void;

  // Menu
  menuItems: MenuItem[];
  addMenuItem: (item: MenuItem) => void;
  updateMenuItem: (id: string, item: Partial<MenuItem>) => void;
  deleteMenuItem: (id: string) => void;

  // Orders
  orders: Order[];
  addOrder: (order: Order) => void;

  // Employees
  employees: Employee[];
  addEmployee: (employee: Employee) => void;
  updateEmployee: (id: string, employee: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;

  // Cart
  cart: { menuItem: MenuItem; quantity: number }[];
  addToCart: (item: MenuItem) => void;
  removeFromCart: (itemId: string) => void;
  updateCartQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
}

// Initial mock data
const initialStocks: StockItem[] = [
  { id: '1', name: 'Kopi Arabica', currentStock: 5000, unit: 'gram', pricePerUnit: 0.5, minStock: 500, category: 'Kopi' },
  { id: '2', name: 'Kopi Robusta', currentStock: 3000, unit: 'gram', pricePerUnit: 0.35, minStock: 500, category: 'Kopi' },
  { id: '3', name: 'Susu Fresh Milk', currentStock: 10000, unit: 'ml', pricePerUnit: 0.025, minStock: 2000, category: 'Susu' },
  { id: '4', name: 'Gula Aren', currentStock: 2000, unit: 'gram', pricePerUnit: 0.08, minStock: 300, category: 'Pemanis' },
  { id: '5', name: 'Cokelat Bubuk', currentStock: 1500, unit: 'gram', pricePerUnit: 0.12, minStock: 200, category: 'Topping' },
  { id: '6', name: 'Es Batu', currentStock: 5000, unit: 'gram', pricePerUnit: 0.01, minStock: 1000, category: 'Es' },
  { id: '7', name: 'Matcha Powder', currentStock: 500, unit: 'gram', pricePerUnit: 0.8, minStock: 100, category: 'Teh' },
  { id: '8', name: 'Sirup Vanilla', currentStock: 1000, unit: 'ml', pricePerUnit: 0.05, minStock: 200, category: 'Sirup' },
];

const initialMenuItems: MenuItem[] = [
  { 
    id: '1', 
    name: 'Espresso', 
    category: 'Kopi', 
    price: 18000,
    ingredients: [
      { stockId: '1', amount: 18 }, // 18g kopi
    ]
  },
  { 
    id: '2', 
    name: 'Americano', 
    category: 'Kopi', 
    price: 22000,
    ingredients: [
      { stockId: '1', amount: 18 },
    ]
  },
  { 
    id: '3', 
    name: 'Cappuccino', 
    category: 'Kopi', 
    price: 28000,
    ingredients: [
      { stockId: '1', amount: 18 },
      { stockId: '3', amount: 150 }, // 150ml susu
    ]
  },
  { 
    id: '4', 
    name: 'Cafe Latte', 
    category: 'Kopi', 
    price: 28000,
    ingredients: [
      { stockId: '1', amount: 18 },
      { stockId: '3', amount: 200 },
    ]
  },
  { 
    id: '5', 
    name: 'Es Kopi Susu Gula Aren', 
    category: 'Kopi', 
    price: 25000,
    ingredients: [
      { stockId: '2', amount: 20 },
      { stockId: '3', amount: 150 },
      { stockId: '4', amount: 30 },
      { stockId: '6', amount: 100 },
    ]
  },
  { 
    id: '6', 
    name: 'Mocha Latte', 
    category: 'Kopi', 
    price: 32000,
    ingredients: [
      { stockId: '1', amount: 18 },
      { stockId: '3', amount: 180 },
      { stockId: '5', amount: 15 },
    ]
  },
  { 
    id: '7', 
    name: 'Matcha Latte', 
    category: 'Non-Kopi', 
    price: 30000,
    ingredients: [
      { stockId: '7', amount: 10 },
      { stockId: '3', amount: 200 },
    ]
  },
  { 
    id: '8', 
    name: 'Vanilla Latte', 
    category: 'Kopi', 
    price: 30000,
    ingredients: [
      { stockId: '1', amount: 18 },
      { stockId: '3', amount: 180 },
      { stockId: '8', amount: 20 },
    ]
  },
];

const initialEmployees: Employee[] = [
  { id: '1', name: 'Ahmad Barista', position: 'Head Barista', baseSalary: 4500000, bonus: 0 },
  { id: '2', name: 'Siti Kasir', position: 'Kasir', baseSalary: 3500000, bonus: 0 },
  { id: '3', name: 'Budi Pramusaji', position: 'Waiter', baseSalary: 3000000, bonus: 0 },
];

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      stocks: initialStocks,
      menuItems: initialMenuItems,
      orders: [],
      employees: initialEmployees,
      cart: [],

      addStock: (stock) => set((state) => ({ stocks: [...state.stocks, stock] })),
      updateStock: (id, stockUpdate) => set((state) => ({
        stocks: state.stocks.map((s) => s.id === id ? { ...s, ...stockUpdate } : s)
      })),
      deleteStock: (id) => set((state) => ({ stocks: state.stocks.filter((s) => s.id !== id) })),
      reduceStock: (stockId, amount) => set((state) => ({
        stocks: state.stocks.map((s) => 
          s.id === stockId ? { ...s, currentStock: Math.max(0, s.currentStock - amount) } : s
        )
      })),

      addMenuItem: (item) => set((state) => ({ menuItems: [...state.menuItems, item] })),
      updateMenuItem: (id, itemUpdate) => set((state) => ({
        menuItems: state.menuItems.map((m) => m.id === id ? { ...m, ...itemUpdate } : m)
      })),
      deleteMenuItem: (id) => set((state) => ({ menuItems: state.menuItems.filter((m) => m.id !== id) })),

      addOrder: (order) => set((state) => ({ orders: [...state.orders, order] })),

      addEmployee: (employee) => set((state) => ({ employees: [...state.employees, employee] })),
      updateEmployee: (id, employeeUpdate) => set((state) => ({
        employees: state.employees.map((e) => e.id === id ? { ...e, ...employeeUpdate } : e)
      })),
      deleteEmployee: (id) => set((state) => ({ employees: state.employees.filter((e) => e.id !== id) })),

      addToCart: (item) => set((state) => {
        const existing = state.cart.find((c) => c.menuItem.id === item.id);
        if (existing) {
          return {
            cart: state.cart.map((c) => 
              c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
            )
          };
        }
        return { cart: [...state.cart, { menuItem: item, quantity: 1 }] };
      }),
      removeFromCart: (itemId) => set((state) => ({
        cart: state.cart.filter((c) => c.menuItem.id !== itemId)
      })),
      updateCartQuantity: (itemId, quantity) => set((state) => ({
        cart: quantity <= 0 
          ? state.cart.filter((c) => c.menuItem.id !== itemId)
          : state.cart.map((c) => c.menuItem.id === itemId ? { ...c, quantity } : c)
      })),
      clearCart: () => set({ cart: [] }),
    }),
    {
      name: 'coffee-shop-storage',
    }
  )
);
