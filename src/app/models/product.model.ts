// This interface represents the data for a product that you receive from the backend.
// It matches your ProductData class.
export interface Product {
  id: number;
  barcode: string;
  name: string;
  category: string;
  mrp: number;
  imageUrl?: string; // The '?' makes this property optional
  clientId: number;
  clientName:string;
  quantity: number;
}

// This interface represents the data you send to the backend when creating a new product.
// It matches your ProductForm class.
export interface ProductForm {
  barcode: string;
  name: string;
  category: string;
  mrp: number;
  imageUrl?: string;
  clientId: number;
}
