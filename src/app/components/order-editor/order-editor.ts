import { Component, OnInit, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, finalize, switchMap } from 'rxjs/operators';
import { trigger, transition, style, animate } from '@angular/animations';

import { Order, OrderForm, OrderItem, OrderItemForm, OrderStatus, OrderUpdateForm, OrderItemUpdateForm } from '../../models/order.model';
import { Product } from '../../models/product.model';
import { OrderService } from '../../services/order';
import { OrderItemService } from '../../services/order-item';
import { ProductService } from '../../services/product';
import { ToastService } from '../../services/toast';
import { handleHttpError } from '../../utils/error-handler';

@Component({
  selector: 'app-order-editor',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './order-editor.html',
  styleUrls: ['./order-editor.css'],
  animations: [
    trigger('shellFadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(15px)' }),
        animate('0.5s ease-out',
          style({ opacity: 1, transform: 'translateY(0)' })
        )
      ])
    ]),
    trigger('fade', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('0.3s 0.2s ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('0.2s ease-in', style({ opacity: 0 }))
      ])
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('0.3s 0.2s ease-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class OrderEditorComponent implements OnInit, AfterViewInit {
  public barcodeInput: string = '';
  // Keep quantityInput as string for text input
  public quantityInput: string = '1';
  public sellingPriceInput: string = '';
  public customerName: string = '';
  public customerPhone: string = '';
  public items: OrderItem[] = [];
  public totalAmount: number = 0;
  public isSubmitting = false;
  public addIcon = 'assets/icon/add-to-cart.png';

  public isEditMode = false;
  public orderIdToEdit: number | null = null;
  private originalItems: OrderItem[] = [];
  private originalCustomerName: string = '';
  private originalCustomerPhone: string = '';

  // Loading states
  public isLoading = false;
  public showContent = false;

  constructor(
    private orderService: OrderService,
    private orderItemService: OrderItemService,
    private productService: ProductService,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService
  ) { }

  ngAfterViewInit(): void {
    // Set up border glow effect for cards
    this.setupGlowEffect();
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(
      switchMap(params => {
        const id = params.get('id');
        if (id) {
          this.isEditMode = true;
          const orderId = +id;
          this.orderIdToEdit = orderId;
          // Start with skeleton visible so cards have proper size from the beginning
          this.isLoading = true;
          this.showContent = false;
          
          // Wait for cards to animate in (0.5s) before fetching data
          // Skeleton is already visible, so cards will have correct size
          setTimeout(() => {
            // Fetch order details after cards have animated in
            this.orderService.getOrderById(orderId).pipe(
              catchError(err => {
                this.toastService.showError('Could not load order details.');
                this.router.navigate(['/orders']);
                return of(null);
              })
            ).subscribe(order => {
              if (order && this.isEditMode) {
                const loadedOrder = order;
                
                // Prefill data immediately
                this.prefillFormForEditing(loadedOrder);
                
                // Show content first (will start fading in)
                this.showContent = true;
                
                // Start skeleton fade-out after content has started fading in (cross-fade)
                setTimeout(() => {
                  this.isLoading = false;
                }, 100); // Allow content to start fading in before skeleton fades out
              } else if (this.isEditMode && !order) {
                this.isLoading = false;
                this.router.navigate(['/orders']);
              }
            });
          }, 500); // Wait for shellFadeIn animation (0.5s)
          
          return of(null); // Return immediately, we handle subscription in setTimeout
        }
        // Not edit mode, no need to fetch - show content immediately
        this.isEditMode = false;
        this.isLoading = false;
        this.showContent = true;
        return of(null);
      })
    ).subscribe(() => {
      // Subscription handled in setTimeout for edit mode
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
  let enteredSellingPrice: number | null = null;
  if (this.sellingPriceInput && this.sellingPriceInput.trim() !== '') {
    enteredSellingPrice = parseFloat(this.sellingPriceInput.trim());
    if (isNaN(enteredSellingPrice) || enteredSellingPrice <= 0) {
      this.toastService.showError('Selling price must be a positive number.');
      return;
    }
  }

  this.productService.getProductByBarcode(this.barcodeInput.trim()).subscribe({
    next: (product) => {
      // Determine final selling price (entered or product.mrp)
      const rawFinalSellingPrice = enteredSellingPrice !== null ? enteredSellingPrice : product.mrp;

      // Normalize to 2 decimal places to avoid float-equality issues
      const finalSellingPrice = Number(rawFinalSellingPrice.toFixed(2));

      // Find existing item with same productId AND same sellingPrice
      const existingItem = this.items.find(item =>
        item.productId === product.id &&
        Number(item.sellingPrice.toFixed(2)) === finalSellingPrice
      );

      if (existingItem) {
        // Item exists with same price: append quantity
        existingItem.quantity += quantity;
      } else {
        // New item (either different product OR same product but different price)
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
        orderStatus: OrderStatus.CREATED // Keep status as CREATED
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
    this.flashTotal();
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

  // --- Glow Effect Setup ---
  private setupGlowEffect(): void {
    const setupCards = () => {
      // Get all cards in the order editor
      const cards = document.querySelectorAll('.page-container .card');

      if (cards.length === 0) {
        setTimeout(setupCards, 100);
        return;
      }

      cards.forEach((card) => {
        if ((card as any).__glowSetup) return;
        (card as any).__glowSetup = true;

        let lastMoveTime = 0;
        let fadeAnimationFrame: number | null = null;
        let positionAnimationFrame: number | null = null;
        let cachedRect: DOMRect | null = null;
        let rectCacheTime = 0;
        
        let targetX = 0;
        let targetY = 0;
        let currentX = 0;
        let currentY = 0;
        
        let lastX = 0;
        let lastY = 0;
        let lastTime = 0;
        const velocityHistory: number[] = [];
        const MAX_VELOCITY_HISTORY = 5;
        let currentVelocity = 0;
        
        let targetSize = 200;
        let currentSize = 200;
        
        const fadeOutDelay = 200;
        const fadeOutDuration = 300;
        const RECT_CACHE_DURATION = 100;
        const SMOOTH_FOLLOW_SPEED = 0.15;
        const MIN_GLOW_SIZE = 150;
        const MAX_GLOW_SIZE = 500;
        const MAX_VELOCITY = 2000;

        const getCachedRect = (): DOMRect => {
          const now = performance.now();
          if (!cachedRect || (now - rectCacheTime) > RECT_CACHE_DURATION) {
            cachedRect = (card as HTMLElement).getBoundingClientRect();
            rectCacheTime = now;
          }
          return cachedRect;
        };

        const lerp = (start: number, end: number, factor: number): number => {
          return start + (end - start) * factor;
        };

        const calculateVelocity = (x: number, y: number, time: number): number => {
          if (lastTime === 0) {
            lastX = x;
            lastY = y;
            lastTime = time;
            return 0;
          }
          
          const deltaTime = (time - lastTime) / 1000;
          if (deltaTime <= 0) return currentVelocity;
          
          const deltaX = x - lastX;
          const deltaY = y - lastY;
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          const instantVelocity = distance / deltaTime;
          
          velocityHistory.push(instantVelocity);
          if (velocityHistory.length > MAX_VELOCITY_HISTORY) {
            velocityHistory.shift();
          }
          
          const avgVelocity = velocityHistory.reduce((a, b) => a + b, 0) / velocityHistory.length;
          
          lastX = x;
          lastY = y;
          lastTime = time;
          
          return avgVelocity;
        };

        const updateGlowSize = (velocity: number): void => {
          const normalizedVelocity = Math.min(velocity / MAX_VELOCITY, 1);
          const easedVelocity = Math.pow(normalizedVelocity, 0.6);
          targetSize = MIN_GLOW_SIZE + (MAX_GLOW_SIZE - MIN_GLOW_SIZE) * easedVelocity;
        };

        const animateGlow = () => {
          const now = performance.now();
          const timeSinceMove = now - lastMoveTime;
          
          currentX = lerp(currentX, targetX, SMOOTH_FOLLOW_SPEED);
          currentY = lerp(currentY, targetY, SMOOTH_FOLLOW_SPEED);
          currentSize = lerp(currentSize, targetSize, 0.1);
          
          // Clamp lerped values to card bounds to prevent overflow
          const rect = getCachedRect();
          const clampedX = Math.max(0, Math.min(currentX, rect.width));
          const clampedY = Math.max(0, Math.min(currentY, rect.height));
          
          (card as HTMLElement).style.setProperty('--card-cursor-x', `${clampedX}px`);
          (card as HTMLElement).style.setProperty('--card-cursor-y', `${clampedY}px`);
          (card as HTMLElement).style.setProperty('--card-glow-size', `${currentSize}px`);
          
          if (timeSinceMove < fadeOutDelay) {
            (card as HTMLElement).style.setProperty('--card-glow-opacity', '1');
            positionAnimationFrame = requestAnimationFrame(animateGlow);
          } else if (timeSinceMove < fadeOutDelay + fadeOutDuration) {
            const fadeProgress = (timeSinceMove - fadeOutDelay) / fadeOutDuration;
            const opacity = 1 - fadeProgress;
            (card as HTMLElement).style.setProperty('--card-glow-opacity', opacity.toString());
            positionAnimationFrame = requestAnimationFrame(animateGlow);
          } else {
            (card as HTMLElement).style.setProperty('--card-glow-opacity', '0');
            positionAnimationFrame = null;
          }
        };

        const handleMouseMove = (e: MouseEvent) => {
          const now = performance.now();
          const rect = getCachedRect();
          // Clamp relative position to card bounds to prevent overflow
          const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
          const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
          
          targetX = x;
          targetY = y;
          currentVelocity = calculateVelocity(x, y, now);
          updateGlowSize(currentVelocity);
          lastMoveTime = now;
          
          if (!positionAnimationFrame) {
            positionAnimationFrame = requestAnimationFrame(animateGlow);
          }
        };

        const handleMouseLeave = () => {
          if (fadeAnimationFrame) {
            cancelAnimationFrame(fadeAnimationFrame);
            fadeAnimationFrame = null;
          }
          if (positionAnimationFrame) {
            cancelAnimationFrame(positionAnimationFrame);
            positionAnimationFrame = null;
          }
          
          cachedRect = null;
          lastMoveTime = 0;
          lastTime = 0;
          velocityHistory.length = 0;
          currentVelocity = 0;
          targetSize = MIN_GLOW_SIZE;
          
          (card as HTMLElement).style.setProperty('--card-glow-opacity', '0');
        };

        card.addEventListener('mousemove', handleMouseMove as EventListener);
        card.addEventListener('mouseleave', handleMouseLeave);
      });
    };

    setTimeout(setupCards, 100);
    
    // Also set up after content loads
    setTimeout(() => {
      setupCards();
    }, 500);
  }

  // --- Error Handling ---
  private handleApiError(err: any, context: string): void {
    const defaultMessage = `An error occurred while ${context}. Please try again.`;
    handleHttpError(err, this.toastService, defaultMessage);
  }

  //Animations
  private flashTotal(): void {
  const el = document.querySelector('.summary-row.total-row');
  if (!el) return;
  el.classList.remove('pulse');
  // force reflow to restart animation
  void (el as HTMLElement).offsetWidth;
  el.classList.add('pulse');
}
}

