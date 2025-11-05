import { Component, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { trigger, state, style, transition, animate } from '@angular/animations';

import { AuthService, AuthUser } from '../../services/auth.service';
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
    ])
  ]
})
export class NavbarComponent implements OnInit, OnDestroy {
  public currentUser: AuthUser | null = null;
  private userSubscription: Subscription = new Subscription();
  public isProfileDropdownOpen = false;
  public isMobileMenuOpen = false;

  constructor(
    private authService: AuthService,
    private elementRef: ElementRef, // Keep ElementRef, it's used by Angular
    private router: Router
  ) { }

  ngOnInit(): void {
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (!user) {
        this.closeProfileDropdown();
        this.closeMobileMenu();
      }
    });
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
    this.authService.logout();
    this.router.navigate(['/login']);
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

