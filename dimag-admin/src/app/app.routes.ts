import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then(m => m.Login),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/dashboard/overview/overview').then(m => m.Overview),
        canActivate: [adminGuard],
      },
      {
        path: 'sales',
        loadComponent: () => import('./pages/dashboard/sales/sales').then(m => m.Sales),
      },
      {
        path: 'inventory',
        loadComponent: () => import('./pages/dashboard/inventory/inventory').then(m => m.Inventory),
        canActivate: [adminGuard],
      },
      {
        path: 'products',
        loadComponent: () => import('./pages/dashboard/products/products').then(m => m.Products),
        canActivate: [adminGuard],
      },
      {
        path: 'users',
        loadComponent: () => import('./pages/dashboard/users/users').then(m => m.Users),
        canActivate: [adminGuard],
      },
    ],
  },
];
