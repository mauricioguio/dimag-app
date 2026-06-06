import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API_URL = 'https://dimag-app-production.up.railway.app/api';

export interface SaleItem {
  id: string; productId: string; productName: string; size: string;
  quantity: number; price: number; note: string | null; deliveredQty: number;
}

export interface SalePayment { id: string; amount: number; note: string | null; createdAt: string; }

export interface SellerSale {
  id: string; orderNumber: number; type: 'STOCK' | 'FABRICAR'; status: string;
  total: number; customerName: string | null; notes: string | null;
  deliveryDate: string | null; paymentMethod: string | null; createdAt: string;
  items: SaleItem[]; payments: SalePayment[]; sede: { id: string; name: string };
}

@Injectable({ providedIn: 'root' })
export class SellerSalesApiService {
  private readonly http = inject(HttpClient);

  getAll() { return this.http.get<SellerSale[]>(`${API_URL}/seller/admin/sales`); }

  updateStatus(saleId: string, status: string) {
    return this.http.patch<SellerSale>(`${API_URL}/seller/admin/sales/${saleId}/status`, { status });
  }

  addPayment(saleId: string, amount: number, note?: string) {
    return this.http.post<SalePayment>(`${API_URL}/seller/admin/fabricar/${saleId}/payment`, { amount, note });
  }

  updateDeliveredQty(saleId: string, items: { itemId: string; deliveredQty: number }[]) {
    return this.http.patch<SellerSale>(`${API_URL}/seller/admin/fabricar/${saleId}/items`, { items });
  }

  delete(saleId: string) {
    return this.http.delete<void>(`${API_URL}/seller/admin/sales/${saleId}`);
  }
}

