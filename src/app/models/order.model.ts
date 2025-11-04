// This enum matches your backend OrderStatus enum for type safety.
export enum OrderStatus {
  CREATED = 'CREATED',
  INVOICED = 'INVOICED',
  CANCELLED = 'CANCELLED'
}

// --- DATA TRANSFER OBJECTS (Interfaces for API data) ---

// This interface defines the structure of a complete order object from your API.
export interface Order {
  id: number;
  orderStatus: OrderStatus;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  orderItemDataList: OrderItem[];
  createdAt: string;
}

// This interface defines the structure for a single item within an order, as returned by the API.
export interface OrderItem {
  id?: number; // The item's own ID in the database
  productId: number;
  productName: string;
  quantity: number;
  sellingPrice: number;
}

// A generic interface for your paginated API response.



// --- FORM INTERFACES (Interfaces for sending data to the API) ---

// For creating a brand new order with its items.
export interface OrderForm {
  customerName: string;
  customerPhone: string;
  items: OrderItemForm[];
}

// For updating the customer details and/or status of an existing order.
export interface OrderUpdateForm {
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
}

// For adding a new item to an existing order.
export interface OrderItemForm {
  productId: number;
  quantity: number;
  sellingPrice: number;
}

// NEW: For updating an existing item within an order.
export interface OrderItemUpdateForm {
  quantity: number;
  sellingPrice: number;
}
