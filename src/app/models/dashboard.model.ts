// Matches the KpiData nested class/record
export interface KpiData {
  current: number;
  previous: number;
  changePercent: number;
}

// Matches the ProductSalesData nested class/record (only fields needed for dashboard)
export interface DashboardProductSales {
  productId: number;
  productName: string;
  quantitySold: number;
  // totalRevenue is likely null here based on your example
}

// Matches the LowStockAlertData nested class/record
export interface LowStockAlert {
  productId: number;
  productName: string;
  currentStock: number;
}

// Matches the SalesByHourData nested class/record (currently unused in this dashboard design)
// export interface SalesByHour {
//   hour: number;
//   revenue: number;
// }

// Matches the main SummaryData class/record
export interface DashboardSummary {
  todaySales: KpiData;
  todayOrders: KpiData;
  averageOrderValue: KpiData;
  salesByHour: any[]; // Not used in this design, keep as any[] for now
  topSellingProducts: DashboardProductSales[]; // Not used in this design, keep for potential future use
  lowStockAlerts: LowStockAlert[];
}
