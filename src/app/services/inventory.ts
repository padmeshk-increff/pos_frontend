import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs'; // Import 'of'
import { delay } from 'rxjs/operators';   // Import 'delay'

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private apiUrl = 'http://localhost:8080/pos/inventory';

  constructor(private http: HttpClient) { }

  uploadInventoryTsv(file: File): Observable<Blob> {
    const formData = new FormData();
    formData.append('file', file);

    // THE FIX: The { responseType: 'blob' } option tells HttpClient to expect a file download.
    return this.http.post(`${this.apiUrl}/upload`, formData, {
      responseType: 'blob'
    });
  }

  updateInventory(productId: number, quantity: number): Observable<any> {
    const body = { quantity: quantity };
    return this.http.put(`${this.apiUrl}/product/${productId}`, body);
  }

  getLowStockItems(): Observable<any[]> {
    // The real API call is commented out
    // return this.http.get<any[]>(this.apiUrl + '/low-stock');

    // MOCK RESPONSE: Create a fake array of items
    const mockLowStockItems = [
      { id: 1, name: 'KitKat', quantity: 5 },
      { id: 2, name: 'Dairy Milk', quantity: 2 },
      { id: 3, name: 'Parle-G', quantity: 8 }
    ];

    return of(mockLowStockItems).pipe(delay(800));
  }
}