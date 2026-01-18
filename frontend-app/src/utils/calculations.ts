import { MenuItem, StockItem, Order } from '@/types';

export function calculateCOGS(menuItem: MenuItem, stocks: StockItem[]): number {
  return menuItem.ingredients.reduce((total, ingredient) => {
    const stock = stocks.find((s) => s.id === ingredient.stockId);
    if (stock) {
      return total + (ingredient.amount * stock.pricePerUnit);
    }
    return total;
  }, 0);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('id-ID').format(num);
}

export function calculateDailySummary(orders: Order[], date: Date) {
  const dateStr = date.toISOString().split('T')[0];
  const dayOrders = orders.filter((o) => 
    new Date(o.timestamp).toISOString().split('T')[0] === dateStr
  );

  const totalSales = dayOrders.reduce((sum, o) => sum + o.total, 0);
  const totalCogs = dayOrders.reduce((sum, o) => sum + o.cogs, 0);

  return {
    date: dateStr,
    totalSales,
    totalCogs,
    grossProfit: totalSales - totalCogs,
    totalOrders: dayOrders.length,
  };
}

export function getStockStatus(stock: StockItem): 'good' | 'warning' | 'critical' {
  const percentage = (stock.currentStock / stock.minStock) * 100;
  if (percentage <= 50) return 'critical';
  if (percentage <= 100) return 'warning';
  return 'good';
}
