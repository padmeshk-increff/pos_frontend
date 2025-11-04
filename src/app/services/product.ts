import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http'; // Import HttpParams
import { Observable } from 'rxjs';
import { Product, ProductForm } from '../models/product.model';
import { PaginationData } from '../models/pagination.model'; // Assuming you have this defined


export interface ProductFilters {
  searchTerm?: string | null;
  clientName?: string | null;
  category?: string | null;
  minMrp?: number | null;
  maxMrp?: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = 'http://localhost:8080/pos/products';

  constructor(private http: HttpClient) { }

  createProduct(form: ProductForm): Observable<Product> {
    return this.http.post<Product>(this.apiUrl, form);
  }
  
  getProductByBarcode(barcode: string): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/barcode/${barcode}`);
  }

  // UPDATED: Replaced getProducts with getFilteredProducts
  getFilteredProducts(filters: ProductFilters, page: number, size: number): Observable<PaginationData<Product>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    // Add filter parameters if they exist
    if (filters.searchTerm) {
      params = params.append('searchTerm', filters.searchTerm);
    }
    if (filters.clientName) {
      params = params.append('clientName', filters.clientName);
    }
    if (filters.category) {
      params = params.append('category', filters.category);
    }
    if (filters.minMrp != null) { // Check for null/undefined explicitly for numbers
      params = params.append('minMrp', filters.minMrp.toString());
    }
    if (filters.maxMrp != null) { // Check for null/undefined explicitly for numbers
      params = params.append('maxMrp', filters.maxMrp.toString());
    }

    // Expect PaginationData<Product> from the backend
    return this.http.get<PaginationData<Product>>(this.apiUrl, { params });
  }

  updateProduct(id: number, form: ProductForm): Observable<Product> {
    return this.http.put<Product>(`${this.apiUrl}/${id}`, form);
  }

  uploadProductsTsv(file: File): Observable<Blob> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/upload`, formData, {
      responseType: 'blob'
    });
  }
}

