import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, catchError } from 'rxjs/operators';
import { of, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { trigger, transition, style, animate } from '@angular/animations';

import { Order, OrderStatus, OrderUpdateForm } from '../../models/order.model';
import { PaginationData } from '../../models/pagination.model';
import { OrderService, OrderFilters } from '../../services/order';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-order-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-page.html',
  styleUrls: ['./order-page.css'],
  animations: [
    trigger('shellFadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(15px)' }),
        // Animate in after a brief delay
        animate('0.6s ease-out',
          style({ opacity: 1, transform: 'translateY(0)' })
        )
      ])
    ]),
    trigger('fade', [
      // :enter (fade in)
      transition(':enter', [
        style({ opacity: 0 }),
        // Wait 300ms (for :leave) then fade in
        animate('0.5s 0.3s ease-out', style({ opacity: 1 }))
      ]),
      // :leave (fade out)
      transition(':leave', [
        // Fade out for 300ms
        animate('0.3s ease-in', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class OrderPageComponent implements OnInit {
  public isLoading = true;
  public orders: Order[] = [];
  public paginationData: PaginationData<Order> | null = null;

  public currentPage = 0;
  public pageSize = 10;

  public filters: OrderFilters = { startDate: null, endDate: null, status: null, orderId: null };
  public searchOrderId: string = '';

  public expandedOrderId: number | null = null;
  public actionLoadingId: number | null = null;

  public OrderStatusEnum = OrderStatus;
  public orderStatusOptions = Object.values(OrderStatus);

  // Confirmation Modal State
  public isConfirmModalVisible = false;
  public isModalClosing = false;
  public orderToConfirm: Order | null = null;
  public confirmModalText = '';
  public confirmModalAction: 'invoice' | 'cancel' | null = null;
  public currentAction: 'invoice' | 'cancel' | null = null;

  constructor(
    private orderService: OrderService,
    private toastService: ToastService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.fetchOrders();
  }

  fetchOrders(showToast: boolean = false): void {
    this.isLoading = true;

    if (this.currentPage === 0) {
      this.orders = [];
    }

    this.orderService.getOrders(this.filters, this.currentPage, this.pageSize)
      .subscribe({
        next: (data) => {
          // Set data immediately
          this.orders = data.content;
          this.paginationData = data;
          // Set isLoading = false. This triggers BOTH :leave and :enter.
          // The animation delay will handle the non-overlap.
          this.isLoading = false;

          if (showToast) this.toastService.showSuccess('Orders refreshed.');
        },
        error: (err) => {
          this.isLoading = false;
          this.orders = [];
          this.paginationData = null;
          this.toastService.showError('Could not load orders.');
        }
      });
  }

  onSearchInputChange(value: string): void {
    this.searchOrderId = value.replace(/[^0-9]/g, ''); // Allow only numbers
  }

  onKeyDown(event: KeyboardEvent): void {
    if (!/[0-9]/.test(event.key) && !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
    }
  }

  onSearchClick(): void {
    // Apply all filters including order ID search
    if (this.searchOrderId.trim()) {
      const id = parseInt(this.searchOrderId.trim(), 10);
      if (isNaN(id)) {
        this.toastService.showError('Invalid order ID.');
        return;
      }
      this.filters.orderId = id;
    } else {
      this.filters.orderId = null;
    }

    // Apply all filters
    this.onFilterChange(true);
  }

  onFilterChange(isFromSearch: boolean = false): void {
    if (!isFromSearch) {
      this.filters.orderId = null;
      this.searchOrderId = '';
    }
    // Only fetch if called from search button, not on individual filter changes
    if (isFromSearch) {
      this.currentPage = 0;
      this.fetchOrders();
    }
  }

  resetFilters(): void {
    this.filters = { startDate: null, endDate: null, status: null, orderId: null };
    this.searchOrderId = '';
    this.onFilterChange(true);
  }

  navigateToCreateOrder(): void {
    this.router.navigate(['/orders/new']);
  }

  navigateToEditOrder(event: Event, order: Order): void {
    event.stopPropagation();
    this.router.navigate(['/orders/edit', order.id]);
  }

  toggleOrderExpansion(orderId: number): void {
    this.expandedOrderId = this.expandedOrderId === orderId ? null : orderId;
  }

  openConfirmationModal(event: Event, order: Order, action: 'invoice' | 'cancel'): void {
    event.stopPropagation();
    this.orderToConfirm = order;
    this.confirmModalAction = action;
    this.confirmModalText = `Are you sure you want to ${action} order #${order.id}?`;
    this.isConfirmModalVisible = true;
  }

  closeConfirmationModal(): void {
    if (this.actionLoadingId) return;
    this.isModalClosing = true;
    setTimeout(() => {
      this.isConfirmModalVisible = false;
      this.isModalClosing = false;
      this.orderToConfirm = null;
    }, 300);
  }

  confirmStatusChange(): void {
    if (!this.orderToConfirm || !this.confirmModalAction) return;

    const orderId = this.orderToConfirm.id;
    const action = this.confirmModalAction;

    this.actionLoadingId = orderId;
    this.currentAction = action;

    let actionObservable: Observable<any>;

    if (action === 'invoice') {
      actionObservable = this.orderService.generateInvoice(orderId);
    } else { // action === 'cancel'
      const form: OrderUpdateForm = {
        customerName: this.orderToConfirm.customerName,
        customerPhone: this.orderToConfirm.customerPhone,
        status: OrderStatus.CANCELLED
      };
      actionObservable = this.orderService.updateOrder(orderId, form);
    }

    actionObservable.pipe(
      finalize(() => {
        this.actionLoadingId = null;
        this.currentAction = null;
        this.closeConfirmationModal();
      })
    ).subscribe({
      next: (response) => {
        let successMessage = `Order #${orderId} has been successfully cancelled.`;
        if (action === 'invoice' && response?.message) {
          successMessage = response.message;
        }
        this.toastService.showSuccess(successMessage);
        this.fetchOrders(true);
      },
      error: (err) => this.handleApiError(err)
    });
  }

  onDownloadInvoice(event: Event, orderId: number): void {
    event.stopPropagation();
    if (this.actionLoadingId) return;
    this.actionLoadingId = orderId;
    this.orderService.downloadInvoice(orderId)
      .pipe(finalize(() => this.actionLoadingId = null))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `invoice-order-${orderId}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          a.remove();
          this.toastService.showSuccess('Invoice download started.');
        },
        error: (err) => this.handleBlobError(err)
      });
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.fetchOrders();
  }

  get totalPagesArray(): number[] {
    return this.paginationData ? Array(this.paginationData.totalPages).fill(0).map((x, i) => i) : [];
  }

  private handleBlobError(err: HttpErrorResponse): void {
    if (err.error instanceof Blob && err.error.type === "application/json") {
      const reader = new FileReader();
      reader.onload = (e: any) => this.handleApiError({ error: JSON.parse(e.target.result) });
      reader.readAsText(err.error);
    } else {
      this.handleApiError(err);
    }
  }

  private handleApiError(err: any): void {
    if (err.error?.message) {
      this.toastService.showError(err.error.message);
    } else if (typeof err.error === 'object' && err.error !== null) {
      Object.values(err.error).forEach((message: any) => this.toastService.showError(message as string));
    } else {
      this.toastService.showError('An unexpected error occurred.');
    }
  }
}

