// src/app/services/order.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Order, OrderStatus, OrderForm, OrderUpdateForm } from '../models/order.model';
import { PaginationData } from '../models/pagination.model';
export interface OrderFilters {
  startDate?: string | null;
  endDate?: string | null;
  status?: OrderStatus | null;
  orderId?: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = 'http://localhost:8080/pos';

  constructor(private http: HttpClient) { }

  createOrder(form: OrderForm): Observable<Order> {
    return this.http.post<Order>(`${this.apiUrl}/orders`, form);
  }

  getOrders(filters: OrderFilters, page: number, size: number): Observable<PaginationData<Order>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (filters.startDate) {
      params = params.append('startDate', new Date(filters.startDate).toISOString());
    }
    if (filters.endDate) {
      params = params.append('endDate', new Date(filters.endDate).toISOString());
    }
    if (filters.status) {
      params = params.append('status', filters.status);
    }
    if (filters.orderId) {
      params = params.append('id', filters.orderId.toString());
    }

    return this.http.get<PaginationData<Order>>(`${this.apiUrl}/orders`, { params });
  }

  updateOrder(orderId: number, form: OrderUpdateForm): Observable<Order> {
    return this.http.put<Order>(`${this.apiUrl}/orders/${orderId}`, form);
  }

  getOrderById(orderId: number): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/orders/${orderId}`);
  }

  generateInvoice(orderId: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/invoices/${orderId}`, {});
  }

  downloadInvoice(orderId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/invoices/${orderId}`, {
      responseType: 'blob'
    });
  }
}