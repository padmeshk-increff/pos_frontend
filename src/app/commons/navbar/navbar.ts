import { Component, OnInit, OnDestroy, HostListener, ElementRef, ChangeDetectorRef, AfterViewChecked } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { trigger, state, style, transition, animate, query, stagger } from '@angular/animations';

import { AuthService} from '../../services/auth.service';
import { AuthUser } from '../../models/auth-user.model';
import { Role } from '../../models/role.enum';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
  animations: [
    trigger('dropdownAnimation', [
      state('void', style({ opacity: 0, transform: 'translateY(-10px)' })),
      state('*', style({ opacity: 1, transform: 'translateY(0)' })),
      transition('void <=> *', [animate('150ms ease-out')])
    ]),
    trigger('mobileMenuAnimation', [
      state('void', style({
        opacity: 0,
        transform: 'translateY(-20px)',
        height: 0
      })),
      state('*', style({
        opacity: 1,
        transform: 'translateY(0)',
        height: '*'
      })),
      transition('void <=> *', [
        animate('200ms ease-out')
      ])
    ]),
    trigger('navLinkFadeIn', [
      state('hidden', style({
        opacity: 0,
        transform: 'translateX(-30px)'
      })),
      state('visible', style({
        opacity: 1,
        transform: 'translateX(0)'
      })),
      transition('hidden => visible', [
        animate('400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)')
      ])
    ])
  ]
})
export class NavbarComponent implements OnInit, OnDestroy, AfterViewChecked {
  public currentUser: AuthUser | null = null;
  private userSubscription: Subscription = new Subscription();
  public isProfileDropdownOpen = false;
  public isMobileMenuOpen = false;
  private previousUserState: AuthUser | null = null;
  public navLinksState: { [key: string]: string } = {};
  
  public navLinks = [
    { route: '/', label: 'Dashboard', exact: true },
    { route: '/orders', label: 'Orders', exact: false },
    { route: '/products', label: 'Products', exact: false },
    { route: '/clients', label: 'Clients', exact: false }
  ];

  constructor(
    private authService: AuthService,
    private elementRef: ElementRef, // Keep ElementRef, it's used by Angular
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      const wasNull = this.previousUserState === null;
      const isNowSet = user !== null;
      
      this.previousUserState = user;
      this.currentUser = user;
      
      // If user just logged in (was null, now has value), trigger animation
      if (wasNull && isNowSet) {
        // Reset all link states to hidden
        this.navLinks.forEach((link) => {
          this.navLinksState[link.route] = 'hidden';
        });
        // Also handle reports link if supervisor
        if (user?.role === Role.SUPERVISOR) {
          this.navLinksState['/reports'] = 'hidden';
        }
        
        // Use setTimeout to ensure DOM is updated, then animate each link with delay
        setTimeout(() => {
          this.navLinks.forEach((link, index) => {
            setTimeout(() => {
              this.navLinksState[link.route] = 'visible';
              this.cdr.detectChanges();
            }, index * 80); // 80ms delay between each link for faster stagger
          });
          
          // Animate reports link last if supervisor
          if (user?.role === Role.SUPERVISOR) {
            setTimeout(() => {
              this.navLinksState['/reports'] = 'visible';
              this.cdr.detectChanges();
            }, this.navLinks.length * 80);
          }
        }, 30); // Reduced initial delay for faster start
      }
      
      if (!user) {
        this.closeProfileDropdown();
        this.closeMobileMenu();
        // Reset animation states
        this.navLinks.forEach(link => {
          this.navLinksState[link.route] = 'hidden';
        });
      }
    });
  }

  ngAfterViewChecked(): void {
    // This lifecycle hook ensures the view is fully updated
  }

  ngOnDestroy(): void {
    this.userSubscription.unsubscribe();
  }

  get userRole(): Role | null {
    return this.currentUser?.role || null;
  }

  get userEmail(): string {
    return this.currentUser?.email || '';
  }

  getInitials(email: string): string {
    if (!email) return '?';
    const firstLetter = email.charAt(0).toUpperCase();
    return firstLetter.match(/[A-Z]/) ? firstLetter : '?';
  }

  toggleProfileDropdown(event: MouseEvent): void {
    event.stopPropagation(); // Prevents document click listener
    this.isProfileDropdownOpen = !this.isProfileDropdownOpen;
    this.isMobileMenuOpen = false;
  }

  toggleMobileMenu(event: MouseEvent): void {
    event.stopPropagation(); // Prevents document click listener
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    this.isProfileDropdownOpen = false;
  }

  closeProfileDropdown(): void {
    this.isProfileDropdownOpen = false;
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }

  onMobileLinkClick(): void {
    this.closeMobileMenu();
  }

  logout(): void {
    this.closeProfileDropdown();
    this.closeMobileMenu();
    // Don't navigate here - authService.logout() handles navigation
    this.authService.logout();
  }

  getRoleDisplayName(role: Role): string {
    return role === Role.SUPERVISOR ? 'Supervisor' : 'Operator';
  }

  // --- FIX: Simplified Click Outside Detection ---
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Clicks on the toggles or dropdowns themselves are stopped by
    // (click)="$event.stopPropagation()" in the HTML.
    // Therefore, *any* click that reaches this document listener
    // is an "outside" click and should close both menus.

    // Check if the mobile menu is open (since it's rendered outside
    // this component's elementRef, we still need a check for it)
    const mobileMenu = document.querySelector('.mobile-nav-links');
    if (mobileMenu && mobileMenu.contains(event.target as Node)) {
      // Click was inside the mobile menu, which already has stopPropagation
      // This check is a failsafe
      return;
    }

    // If click was not on mobile menu, and it reached here, close all.
    this.closeProfileDropdown();
    this.closeMobileMenu();
  }
}