import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, finalize, switchMap } from 'rxjs/operators';

import { Order, OrderForm, OrderItem, OrderItemForm, OrderStatus, OrderUpdateForm, OrderItemUpdateForm } from '../../models/order.model';
import { Product } from '../../models/product.model';
import { OrderService } from '../../services/order';
import { OrderItemService } from '../../services/order-item';
import { ProductService } from '../../services/product';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-order-editor',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './order-editor.html',
  styleUrls: ['./order-editor.css']
})
export class OrderEditorComponent implements OnInit {
  public barcodeInput: string = '';
  // Keep quantityInput as string for text input
  public quantityInput: string = '1';
  public sellingPriceInput: string = '';
  public customerName: string = '';
  public customerPhone: string = '';
  public items: OrderItem[] = [];
  public totalAmount: number = 0;
  public isSubmitting = false;

  public isEditMode = false;
  public orderIdToEdit: number | null = null;
  private originalItems: OrderItem[] = [];
  private originalCustomerName: string = '';
  private originalCustomerPhone: string = '';

  constructor(
    private orderService: OrderService,
    private orderItemService: OrderItemService,
    private productService: ProductService,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService
  ) { }

  ngOnInit(): void {
    this.route.paramMap.pipe(
      switchMap(params => {
        const id = params.get('id');
        if (id) {
          this.isEditMode = true;
          this.orderIdToEdit = +id;
          // Fetch order details only if ID is present
          return this.orderService.getOrderById(this.orderIdToEdit).pipe(
            catchError(err => {
              this.toastService.showError('Could not load order details.');
              this.router.navigate(['/orders']);
              return of(null); // Return null observable on error
            })
          );
        }
        // Not edit mode, no need to fetch
        this.isEditMode = false;
        return of(null);
      })
    ).subscribe(order => {
      // Check if order data was successfully fetched
      if (order && this.isEditMode) {
        this.prefillFormForEditing(order);
      } else if (this.isEditMode && !order) {
        // Handle case where fetching failed but ID was present
        this.router.navigate(['/orders']);
      }
      // If not edit mode or fetch failed, form remains empty
    });
  }


  private prefillFormForEditing(order: Order): void {
    if (order.orderStatus !== OrderStatus.CREATED) {
      this.toastService.showError('Only orders with "CREATED" status can be edited.');
      this.router.navigate(['/orders']);
      return;
    }
    this.customerName = order.customerName || '';
    this.customerPhone = order.customerPhone || '';
    // Ensure orderItemDataList exists and is an array
    this.items = order.orderItemDataList?.map(item => ({ ...item })) || [];
    this.originalItems = JSON.parse(JSON.stringify(this.items));
    this.originalCustomerName = this.customerName;
    this.originalCustomerPhone = this.customerPhone;
    this.calculateTotal();
  }

  // --- Quantity Input Handlers ---
  onQuantityKeyDown(event: KeyboardEvent): void {
    // Allow only numbers and essential keys
    if (!/[0-9]/.test(event.key) && !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
    }
  }

  onQuantityInputChange(value: string): void {
    // Keep only numbers in the input model
    this.quantityInput = value.replace(/[^0-9]/g, '');
  }

  onSellingPriceKeyDown(event: KeyboardEvent): void {
    // Allow numbers, one decimal point, and essential keys
    const { key } = event;
    const currentValue = (event.target as HTMLInputElement).value;

    if (
      !/[0-9]/.test(key) && // Not a number
      !(key === '.' && !currentValue.includes('.')) && // Not a decimal (and only one)
      !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(key)
    ) {
      event.preventDefault();
    }
  }

  onSellingPriceInputChange(value: string): void {
    // Keep only valid decimal number format
    let newValue = value.replace(/[^0-9.]/g, ''); // Remove invalid chars
    const parts = newValue.split('.');
    if (parts.length > 2) {
      // More than one decimal point
      newValue = parts[0] + '.' + parts.slice(1).join('');
    }
    this.sellingPriceInput = newValue;
  }

  addItem(): void {
    if (!this.barcodeInput.trim()) {
      this.toastService.showError('Please enter a barcode.');
      return;
    }

    if (!this.quantityInput || this.quantityInput.trim() === '') {
      this.toastService.showError('Please enter a quantity.');
      return;
    }
    const quantity = parseInt(this.quantityInput.trim(), 10);
    if (isNaN(quantity) || quantity < 1) {
      this.toastService.showError('Quantity must be at least 1.');
      return;
    }

    // --- Parse selling price (if entered) ---
    let newSellingPrice: number | null = null;
    if (this.sellingPriceInput && this.sellingPriceInput.trim() !== '') {
      newSellingPrice = parseFloat(this.sellingPriceInput.trim());
      if (isNaN(newSellingPrice) || newSellingPrice <= 0) {
        this.toastService.showError('Selling price must be a positive number.');
        return;
      }
    }

    this.productService.getProductByBarcode(this.barcodeInput.trim()).subscribe({
      next: (product) => {

        // --- LOGIC CHANGE: Find existing item by Product ID ONLY ---
        const existingItem = this.items.find(item => item.productId === product.id);

        if (existingItem) {
          // --- 1. Item Exists: Update it ---

          // Add the new quantity
          existingItem.quantity += quantity;

          // Update price ONLY if a new one was entered
          if (newSellingPrice !== null) {
            existingItem.sellingPrice = newSellingPrice;
          }
          // If newSellingPrice is null, the existingItem.sellingPrice is left unchanged

        } else {
          // --- 2. Item is New: Add it ---

          // Use the entered price if available, otherwise default to product's MRP
          const finalSellingPrice = newSellingPrice !== null ? newSellingPrice : product.mrp;

          const newItem: OrderItem = {
            productId: product.id,
            productName: product.name,
            quantity: quantity,
            sellingPrice: finalSellingPrice
          };
          this.items.push(newItem);
        }

        // --- Reset inputs and update total ---
        this.calculateTotal();
        this.barcodeInput = '';
        this.quantityInput = '1';
        this.sellingPriceInput = ''; // Clear price input
      },
      error: (err) => this.handleApiError(err, 'finding product')
    });
  }


  submitOrder(): void {
    if (this.isEditMode) {
      this.updateOrder();
    } else {
      this.placeOrder();
    }
  }

  private placeOrder(): void {
    if (this.items.length === 0) {
      this.toastService.showError('Cannot place an empty order.');
      return;
    }
    this.isSubmitting = true;
    const orderForm: OrderForm = {
      customerName: this.customerName.trim() || '',
      customerPhone: this.customerPhone.trim() || '',
      items: this.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice
      }))
    };
    this.orderService.createOrder(orderForm)
      .pipe(finalize(() => this.isSubmitting = false))
      .subscribe({
        next: (createdOrder) => {
          this.toastService.showSuccess(`Order #${createdOrder.id} placed successfully!`);
          this.resetOrder();
          this.router.navigate(['/orders']);
        },
        error: (err) => this.handleApiError(err, 'placing order')
      });
  }

  private updateOrder(): void {
    if (!this.orderIdToEdit) return;
    if (this.items.length === 0) {
      this.toastService.showError('Cannot update order to have no items. Cancel the order instead.');
      return;
    }
    this.isSubmitting = true;
    const updateObservables: Observable<any>[] = [];

    // --- Update Order Details (Customer Info) if changed ---
    const customerNameTrimmed = this.customerName.trim();
    const customerPhoneTrimmed = this.customerPhone.trim();
    const customerInfoChanged = customerNameTrimmed !== this.originalCustomerName || customerPhoneTrimmed !== this.originalCustomerPhone;

    if (customerInfoChanged) {
      const orderUpdateForm: OrderUpdateForm = {
        customerName: customerNameTrimmed || '',
        customerPhone: customerPhoneTrimmed || '',
        status: OrderStatus.CREATED // Keep status as CREATED
      };
      updateObservables.push(this.orderService.updateOrder(this.orderIdToEdit, orderUpdateForm));
    }

    // --- Determine Item Changes ---
    const originalItemMap = new Map(this.originalItems.filter(item => item.id != null).map(item => [item.id!, item]));
    const currentItemMap = new Map(this.items.filter(item => item.id != null).map(item => [item.id!, item]));

    // Deletions: Items in original map but not in current map
    this.originalItems.forEach(originalItem => {
      if (originalItem.id != null && !currentItemMap.has(originalItem.id)) {
        updateObservables.push(
          this.orderItemService.deleteItem(this.orderIdToEdit!, originalItem.id).pipe(
            catchError(err => {
              console.error(`Failed to delete item ${originalItem.id}:`, err);
              return of({ error: `Failed to delete item ${originalItem.productName}` });
            })
          )
        );
      }
    });

    // Additions & Updates
    this.items.forEach(currentItem => {
      if (currentItem.id == null) {
        // Addition
        const form: OrderItemForm = {
          productId: currentItem.productId,
          quantity: currentItem.quantity,
          sellingPrice: currentItem.sellingPrice
        };
        updateObservables.push(
          this.orderItemService.addItem(this.orderIdToEdit!, form).pipe(
            catchError(err => {
              console.error(`Failed to add item ${currentItem.productName}:`, err);
              return of({ error: `Failed to add item ${currentItem.productName}` });
            })
          )
        );
      } else {
        // Potential Update
        const originalItem = originalItemMap.get(currentItem.id);
        if (originalItem && (originalItem.quantity !== currentItem.quantity || originalItem.sellingPrice !== currentItem.sellingPrice)) {
          const form: OrderItemUpdateForm = {
            quantity: currentItem.quantity,
            sellingPrice: currentItem.sellingPrice
          };
          updateObservables.push(
            this.orderItemService.updateItem(this.orderIdToEdit!, currentItem.id, form).pipe(
              catchError(err => {
                console.error(`Failed to update item ${currentItem.id}:`, err);
                return of({ error: `Failed to update item ${currentItem.productName}` });
              })
            )
          );
        }
      }
    });

    // Execute all changes
    forkJoin(updateObservables.length > 0 ? updateObservables : [of(null)])
      .pipe(finalize(() => this.isSubmitting = false))
      .subscribe({
        next: (results) => {
          const errors = results.filter((res: any) => res && res.error);
          if (errors.length > 0) {
            errors.forEach((err: any) => this.toastService.showError(err.error));
            this.toastService.showError(`Order #${this.orderIdToEdit} updated with some issues. Please review.`);
            this.orderService.getOrderById(this.orderIdToEdit!).subscribe(order => this.prefillFormForEditing(order));
          } else if (updateObservables.length > 0 || customerInfoChanged) {
            this.toastService.showSuccess(`Order #${this.orderIdToEdit} updated successfully!`);
            this.router.navigate(['/orders']);
          } else {
            this.toastService.showSuccess('No changes detected in the order.');
            this.router.navigate(['/orders']);
          }
        },
        error: (err) => {
          this.handleApiError(err, 'updating order');
        }
      });
  }


  // --- Item List Actions ---
  increaseQuantity(index: number): void {
    if (this.items[index]) {
      this.items[index].quantity++;
      this.calculateTotal();
    }
  }
  decreaseQuantity(index: number): void {
    if (this.items[index]) {
      this.items[index].quantity--;
      if (this.items[index].quantity <= 0) {
        this.removeItem(index);
      } else {
        this.calculateTotal();
      }
    }
  }
  removeItem(index: number): void {
    if (index >= 0 && index < this.items.length) {
      this.items.splice(index, 1);
      this.calculateTotal();
    }
  }

  // --- Calculations & Reset ---
  private calculateTotal(): void {
    this.totalAmount = this.items.reduce((sum, item) => sum + (item.quantity * item.sellingPrice), 0);
  }
  private resetOrder(): void {
    this.items = [];
    this.customerName = '';
    this.customerPhone = '';
    this.barcodeInput = '';
    this.quantityInput = '1';
    this.isEditMode = false;
    this.orderIdToEdit = null;
    this.originalItems = [];
    this.originalCustomerName = '';
    this.originalCustomerPhone = '';
    this.calculateTotal();
  }

  // --- Error Handling ---
  private handleApiError(err: any, context: string): void {
    console.error(`Error ${context}:`, err);
    if (err instanceof HttpErrorResponse) {
      if (err.error?.message && typeof err.error.message === 'string') {
        this.toastService.showError(err.error.message);
      } else if (typeof err.error === 'string') {
        this.toastService.showError(err.error);
      } else {
        this.toastService.showError(`An error occurred while ${context}. Status: ${err.status}`);
      }
    } else {
      this.toastService.showError(`An unexpected error occurred while ${context}.`);
    }
  }
}

