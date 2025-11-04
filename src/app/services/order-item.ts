import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { OrderItem, OrderItemForm, OrderItemUpdateForm } from '../models/order.model';

@Injectable({
  providedIn: 'root'
})
export class OrderItemService {
  private apiUrl = 'http://localhost:8080/pos/orders';

  constructor(private http: HttpClient) { }

  addItem(orderId: number, form: OrderItemForm): Observable<OrderItem> {
    // THE FIX: Updated the return type here
    return this.http.post<OrderItem>(`${this.apiUrl}/${orderId}/items`, form);
  }

  updateItem(orderId: number, itemId: number, form: OrderItemUpdateForm): Observable<OrderItem> {
    // THE FIX: Updated the return type here
    return this.http.put<OrderItem>(`${this.apiUrl}/${orderId}/items/${itemId}`, form);
  }

  deleteItem(orderId: number, itemId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${orderId}/items/${itemId}`);
  }
}

