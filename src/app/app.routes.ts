import { Routes } from '@angular/router';

// Import all necessary components
import { LayoutComponent } from './commons/layout/layout';
import { HomePageComponent } from './components/home-page/home-page';
import { ClientPageComponent } from './components/client-page/client-page';
import { OrderEditorComponent } from './components/order-editor/order-editor';
import { ProductPageComponent } from './components/product-page/product-page';
import { OrderPageComponent } from './components/order-page/order-page';
import { LoginPageComponent } from './components/login/login';
import { SignupPageComponent } from './components/signup/signup';
import { ReportPageComponent } from './components/report/report';
import { authGuard } from './guards/auth-guard';
import { roleGuard } from './guards/role-guard'; // 1. Import the new roleGuard
import { Role } from './models/role.enum';     // 2. Import the Role enum

export const routes: Routes = [
  // --- PUBLIC ROUTES ---
  { path: 'login', component: LoginPageComponent },
  { path: 'signup', component: SignupPageComponent },

  // --- PROTECTED ROUTES ---
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard], // This guard checks if user is logged in
    children: [
      {
        path: '', // Default page (Dashboard/Home)
        component: HomePageComponent
      },
      {
        path: 'clients',
        component: ClientPageComponent
      },
      {
        path: 'products',
        component: ProductPageComponent
      },
      {
        path: 'orders',
        children: [
          { path: '', component: OrderPageComponent }, // /orders
          { path: 'new', component: OrderEditorComponent }, // /orders/new
          { path: 'edit/:id', component: OrderEditorComponent } // /orders/edit/:id
        ]
      },
      // --- UPDATED: Reports Route ---
      {
        path: 'reports',
        component: ReportPageComponent,
        // 3. Add the roleGuard and data
        canActivate: [roleGuard], // This guard checks for the specific role
        data: {
          roles: [Role.SUPERVISOR] // Only users with this role can access /reports
        }
      }
      // --- END UPDATE ---
    ]
  },

  // --- FALLBACK ROUTE ---
  { path: '**', redirectTo: '/login' }
];

