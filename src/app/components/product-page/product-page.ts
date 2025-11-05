import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { forkJoin, Observable, of } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { trigger, transition, style, animate } from '@angular/animations';
import { ProductService, ProductFilters } from '../../services/product';
import { InventoryService } from '../../services/inventory';
import { Product, ProductForm } from '../../models/product.model';
import { PaginationData } from '../../models/pagination.model';
import { ToastService } from '../../services/toast';

import { AuthService } from '../../services/auth.service';
import { Role } from '../../models/role.enum';

// Interface for the report file blob and name
interface ReportFile {
  blob: Blob;
  name: string;
}

@Component({
  selector: 'app-product-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-page.html',
  styleUrls: ['./product-page.css'],
  animations: [
    trigger('shellFadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(15px)' }),
        // Fade in shell with no delay
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
export class ProductPageComponent implements OnInit, OnDestroy {
  // --- STATE ---
  public products: Product[] = [];
  public isLoading = true;
  public isSaving = false;

  // Filter State
  public filters: ProductFilters = {
    searchTerm: null,
    clientName: null,
    category: null,
    minMrp: null,
    maxMrp: null
  };

  // Pagination State
  public paginationData: PaginationData<Product> | null = null;
  public currentPage = 0;
  public pageSize = 10; // Default page size

  // Add/Edit Modal State
  public isEditModalVisible = false;
  public productToEdit: Product | null = null;
  public originalProductState: Product | null = null;
  public isAddModalVisible = false;
  public newProduct: ProductForm | null = null;
  public isModalClosing = false;

  // Upload Modal State
  public isUploadModalVisible = false;
  public uploadType: 'product' | 'inventory' | null = null;
  public uploadFile: File | null = null;
  public isUploadingProduct = false;
  public isUploadingInventory = false;
  public uploadReport: ReportFile | null = null;

  // --- NEW: Header constants ---
  // Made public so the template can access them
  public readonly productHeaders = ["Barcode", "Name", "Category", "MRP", "ClientName"];
  public readonly inventoryHeaders = ["Barcode", "Quantity"];
  // --- END NEW ---
  public userRole: Role | null = null;
  public RoleEnum = Role;
  // ViewChild to get the file input from the template
  @ViewChild('uploadFileInput') uploadFileInputRef: ElementRef<HTMLInputElement> | undefined;


  constructor(
    private router: Router,
    private productService: ProductService,
    private inventoryService: InventoryService,
    private toastService: ToastService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.fetchProducts();
    this.userRole = this.authService.currentUserValue?.role || null
  }

  ngOnDestroy(): void {
    // Ensure scroll is re-enabled if component is destroyed
    document.body.style.overflow = 'auto';
  }

  // --- DATA FETCHING & FILTERING ---
  fetchProducts(): void {
    this.isLoading = true;

    // Clear products array, but keep pagination data to avoid flicker
    if (this.currentPage === 0) {
      this.products = [];
      // this.paginationData = null; // <-- Keeping this non-null fixes the flicker
    }

    const apiFilters: ProductFilters = {
      searchTerm: this.filters.searchTerm?.trim() || null,
      clientName: this.filters.clientName?.trim() || null,
      category: this.filters.category?.trim() || null,
      minMrp: this.isValidNumber(this.filters.minMrp) ? Number(this.filters.minMrp) : null,
      maxMrp: this.isValidNumber(this.filters.maxMrp) ? Number(this.filters.maxMrp) : null,
    };

    if (apiFilters.minMrp != null && apiFilters.maxMrp != null && apiFilters.minMrp > apiFilters.maxMrp) {
      this.toastService.showError('Min MRP cannot be greater than Max MRP.');
      this.isLoading = false;
      return;
    }

    this.productService.getFilteredProducts(apiFilters, this.currentPage, this.pageSize)
      .subscribe({
        next: (data) => {
          this.products = data.content;
          this.paginationData = data;
          if (data.totalPages > 0 && this.currentPage >= data.totalPages) {
            this.currentPage = Math.max(0, data.totalPages - 1);
          }
          // Set isLoading to false *after* data is set
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          this.handleApiError(err);
        }
      });
  }

  applyFilters(): void {
    this.currentPage = 0; // Reset to first page when filters change
    this.fetchProducts();
  }

  resetFilters(): void {
    this.filters = { searchTerm: null, clientName: null, category: null, minMrp: null, maxMrp: null };
    this.currentPage = 0;
    this.fetchProducts(); // Fetch after resetting
  }

  // --- PAGINATION ---
  goToPage(page: number): void {
    if (page < 0 || (this.paginationData && page >= this.paginationData.totalPages)) {
      return; // Prevent going out of bounds
    }
    this.currentPage = page;
    this.fetchProducts();
  }

  // --- MRP INPUT VALIDATION ---
  validateMrpInput(field: 'minMrp' | 'maxMrp', value: string | number | null): void {
    if (value === null || value === '') {
      this.filters[field] = null;
      return;
    }

    let stringValue = String(value);

    // Regex to remove invalid characters (anything not a number or a dot)
    let numericValue = stringValue.replace(/[^0-9.]/g, '');

    // Ensure only one dot
    const parts = numericValue.split('.');
    if (parts.length > 2) {
      numericValue = parts[0] + '.' + parts.slice(1).join('');
    }

    // Truncate to 2 decimal places
    if (parts[1] && parts[1].length > 2) {
      numericValue = parts[0] + '.' + parts[1].substring(0, 2);
    }

    const finalValue = (numericValue && numericValue !== '.') ? Number(numericValue) : null;

    // Only update if the model value is different, to prevent infinite loops
    if (this.filters[field] !== finalValue) {
      // Use setTimeout to update the value in the next tick
      setTimeout(() => {
        this.filters[field] = finalValue;
      });
    }
  }


  // Helper to check if a value is a valid number
  private isValidNumber(value: any): boolean {
    if (value === null || value === undefined || value === '') return false;
    const num = Number(value);
    return !isNaN(num) && num >= 0;
  }


  // --- ADD/EDIT MODAL CONTROLS ---
  openAddModal(): void {
    document.body.style.overflow = 'hidden';
    this.newProduct = { name: '', barcode: '', category: '', mrp: null as any, clientId: null as any, imageUrl: '' };
    this.isAddModalVisible = true;
    this.isModalClosing = false;
  }

  closeAddModal(): void {
    if (this.isModalClosing || this.isSaving) return;
    this.isModalClosing = true;
    setTimeout(() => {
      document.body.style.overflow = 'auto';
      this.isAddModalVisible = false;
      this.isModalClosing = false;
      this.newProduct = null;
    }, 300);
  }

  openEditModal(product: Product): void {
    document.body.style.overflow = 'hidden';
    this.productToEdit = JSON.parse(JSON.stringify(product));
    this.originalProductState = product;
    this.isEditModalVisible = true;
    this.isModalClosing = false;
  }

  closeEditModal(): void {
    if (this.isModalClosing || this.isSaving) return;
    this.isModalClosing = true;
    setTimeout(() => {
      document.body.style.overflow = 'auto';
      this.isEditModalVisible = false;
      this.isModalClosing = false;
      this.productToEdit = null;
      this.originalProductState = null;
    }, 300);
  }

  closeModalOnBackdropClick(event: MouseEvent, modalType: 'edit' | 'add' | 'upload'): void {
    if (this.isSaving || this.isUploadingProduct || this.isUploadingInventory) return;
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      switch (modalType) {
        case 'edit': this.closeEditModal(); break;
        case 'add': this.closeAddModal(); break;
        case 'upload': this.closeUploadModal(); break;
      }
    }
  }

  // --- DATA MANIPULATION LOGIC ---
  addProduct(): void {
    if (!this.newProduct || this.isSaving) return;
    if (!this.newProduct.name.trim() || !this.newProduct.barcode.trim() || !this.newProduct.category.trim()) {
      this.toastService.showError('Name, Barcode, and Category are required.');
      return;
    }
    if (this.newProduct.mrp <= 0 || this.newProduct.clientId <= 0) {
      this.toastService.showError('MRP and Client ID must be positive numbers.');
      return;
    }

    this.isSaving = true;
    const clientProductForm = this.newProduct;
    let addedSuccessfully = false;

    this.productService.createProduct(clientProductForm)
      .pipe(finalize(() => {
        // finalize runs after next/error and after the observable completes
        this.isSaving = false;
        if (addedSuccessfully) {
          // close modal only after isSaving has been cleared
          this.closeAddModal();
        }
      }))
      .subscribe({
        next: (newProd) => {
          addedSuccessfully = true;
          this.toastService.showSuccess('Product added successfully!');
          // Keep page consistent: add locally then refresh filtered results
          this.products.push(newProd);
          this.products.sort((a, b) => a.id - b.id);
          this.applyFilters();
          // DO NOT call closeAddModal() here because isSaving is still true
        },
        error: (err) => this.handleApiError(err)
      });
  }


  saveProductChanges(): void {
    if (!this.productToEdit || !this.originalProductState || this.isSaving) return;

    if (!this.productToEdit.mrp || this.productToEdit.mrp <= 0) {
      this.toastService.showError("MRP must be a positive number.");
      return;
    }
    if (this.productToEdit.quantity === null || this.productToEdit.quantity < 0) {
      this.toastService.showError("Inventory must be 0 or greater.");
      return;
    }

    this.isSaving = true;
    let updatedSuccessfully = false;
    const observables: Observable<any>[] = [];

    const productForm: ProductForm = {
      name: this.productToEdit.name,
      barcode: this.productToEdit.barcode,
      category: this.productToEdit.category,
      mrp: this.productToEdit.mrp,
      imageUrl: this.productToEdit.imageUrl,
      clientId: this.productToEdit.clientId
    };

    const productChanged = productForm.mrp !== this.originalProductState.mrp;
    if (productChanged) {
      observables.push(this.productService.updateProduct(this.productToEdit.id, productForm));
    }

    if (this.productToEdit.quantity !== this.originalProductState.quantity) {
      observables.push(this.inventoryService.updateInventory(this.productToEdit.id, this.productToEdit.quantity));
    }

    if (observables.length === 0) {
      this.toastService.showSuccess('No changes were made.');
      this.isSaving = false;
      this.closeEditModal();
      return;
    }

    // --- MODIFIED: Apply same finalize logic as addProduct ---
    forkJoin(observables)
      .pipe(finalize(() => {
        this.isSaving = false;
        if (updatedSuccessfully) { // <-- Check flag
          this.closeEditModal(); // <-- Close modal here
        }
      }))
      .subscribe({
        next: () => {
          updatedSuccessfully = true; // <-- Set flag on success
          this.toastService.showSuccess('Product updated successfully!');
          this.fetchProducts();
          // DO NOT close modal here anymore
        },
        error: (err) => this.handleApiError(err) // <-- On error, flag stays false, modal stays open
      });
  }

  // --- UPLOAD MODAL CONTROLS & LOGIC ---
  openUploadModal(type: 'product' | 'inventory'): void {
    this.uploadType = type;
    this.uploadFile = null;
    this.uploadReport = null;
    this.isUploadModalVisible = true;
    this.isModalClosing = false;
    document.body.style.overflow = 'hidden';
  }

  closeUploadModal(): void {
    if (this.isModalClosing || this.isUploadingProduct || this.isUploadingInventory) return;
    this.isModalClosing = true;
    setTimeout(() => {
      document.body.style.overflow = 'auto';
      this.isUploadModalVisible = false;
      this.isModalClosing = false;
      this.uploadType = null;
      this.uploadFile = null;
      this.uploadReport = null;
    }, 300);
  }

  onUploadFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.uploadFile = (input.files && input.files.length) ? input.files[0] : null;
    this.uploadReport = null;
  }

  uploadFileFromModal(): void {
    const fileInput = this.uploadFileInputRef?.nativeElement;
    if (!this.uploadFile || !this.uploadType || !fileInput) {
      this.toastService.showError("File input not found.");
      return;
    }
    if (this.uploadType === 'product') {
      this.uploadProductTsv(fileInput);
    } else {
      this.uploadInventoryTsv(fileInput);
    }
  }

  uploadProductTsv(fileInputRef: HTMLInputElement): void {
    if (!this.uploadFile || this.isUploadingProduct) return;
    this.isUploadingProduct = true;

    this.productService.uploadProductsTsv(this.uploadFile)
      .pipe(finalize(() => this.isUploadingProduct = false))
      .subscribe({
        next: (blob) => {
          this.uploadReport = { blob, name: 'product-upload-report.tsv' };
          this.toastService.showSuccess('Product upload processed. Report ready.');
          this.fetchProducts();
          this.uploadFile = null;
          fileInputRef.value = '';
        },
        error: (err) => this.handleBlobError(err)
      });
  }

  uploadInventoryTsv(fileInputRef: HTMLInputElement): void {
    if (!this.uploadFile || this.isUploadingInventory) return;
    this.isUploadingInventory = true;

    this.inventoryService.uploadInventoryTsv(this.uploadFile)
      .pipe(finalize(() => this.isUploadingInventory = false))
      .subscribe({
        next: (blob) => {
          this.uploadReport = { blob, name: 'inventory-upload-report.tsv' };
          this.toastService.showSuccess('Inventory upload processed. Report ready.');
          this.fetchProducts();
          this.uploadFile = null;
          fileInputRef.value = '';
        },
        error: (err) => this.handleBlobError(err)
      });
  }


  downloadReport(): void {
    if (!this.uploadReport) return;
    const url = window.URL.createObjectURL(this.uploadReport.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.uploadReport.name;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  }

  clearReportAndResetModal(): void {
    this.uploadReport = null;
    this.uploadFile = null;
    if (this.uploadFileInputRef?.nativeElement) {
      this.uploadFileInputRef.nativeElement.value = '';
    }
  }

  // --- Download Sample TSV ---
  downloadSampleTsv(): void {
    let tsvContent: string; // Changed variable name
    let filename: string;

    if (this.uploadType === 'product') {
      // Create headers (row 1)
      const headers = this.productHeaders.join("\t");
      // Create an example data row (row 2)
      const exampleRow = "BC12345\tSample Product\tSample Category\t199.99\tSample Client";

      tsvContent = headers + "\n" + exampleRow; // Combine headers and data
      filename = "product_master_sample.tsv";

    } else if (this.uploadType === 'inventory') {
      // Create headers (row 1)
      const headers = this.inventoryHeaders.join("\t");
      // Create an example data row (row 2)
      const exampleRow = "BC12345\t50";

      tsvContent = headers + "\n" + exampleRow; // Combine headers and data
      filename = "inventory_sample.tsv";

    } else {
      return; // Should not happen
    }

    const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    this.toastService.showSuccess(`Downloading ${filename}`);
  }


  // --- ERROR HANDLING & UTILITIES ---
  private handleBlobError(err: HttpErrorResponse): void {
    if (err.error instanceof Blob && err.error.type === "application/json") {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const errorData = JSON.parse(e.target.result);
          this.handleApiError({ error: errorData });
        } catch (parseError) {
          this.toastService.showError('An unexpected error occurred processing the upload report.');
        }
      };
      reader.onerror = () => {
        this.toastService.showError('Failed to read the error report.');
      };
      reader.readAsText(err.error);
    } else {
      this.handleApiError(err);
    }
  }

  private handleApiError(err: any): void {
    if (err.error?.message && typeof err.error.message === 'string') {
      this.toastService.showError(err.error.message);
    } else if (typeof err.error === 'object' && err.error !== null) {
      Object.values(err.error).forEach((message: any) => {
        if (typeof message === 'string') {
          this.toastService.showError(message);
        }
      });
    } else if (typeof err.message === 'string') {
      this.toastService.showError(err.message);
    }
    else {
      this.toastService.showError('An unexpected error occurred.');
    }
    console.error("API Error:", err);
  }

  onDecimalKeyDown(event: KeyboardEvent): void {
    const { key, target } = event;
    const currentValue = (target as HTMLInputElement).value;

    if (
      !/[0-9]/.test(key) &&
      !(key === '.' && !currentValue.includes('.')) &&
      !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)
    ) {
      event.preventDefault(); // Block invalid key
    }
  }

  /** Allows only numbers and control keys. */
  onNumericKeyDown(event: KeyboardEvent): void {
    const { key } = event;

    if (
      !/[0-9]/.test(key) &&
      !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)
    ) {
      event.preventDefault(); // Block invalid key
    }
  }

  // --- ngModelChange handlers for parsing string input to number/null ---

  onEditMrpChange(value: string): void {
    if (!this.productToEdit) return;
    this.productToEdit.mrp = (value && value !== '.') ? parseFloat(value) : null as any;
  }

  onEditInventoryChange(value: string): void {
    if (!this.productToEdit) return;
    this.productToEdit.quantity = (value !== '') ? parseInt(value, 10) : null as any;
  }

  onNewMrpChange(value: string): void {
    if (!this.newProduct) return;
    this.newProduct.mrp = (value && value !== '.') ? parseFloat(value) : null as any;
  }

  onNewClientIdChange(value: string): void {
    if (!this.newProduct) return;
    this.newProduct.clientId = (value !== '') ? parseInt(value, 10) : null as any;
  }


  // --- END NEW ---
  trackProductById(index: number, product: Product): number {
    return product.id;
  }
}

