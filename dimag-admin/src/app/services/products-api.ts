import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API_URL = 'https://dimag-app-production.up.railway.app/api';

export interface ProductColor { name: string; hex: string; }

export interface Product {
  id: string; name: string; collection: string; price: number;
  description: string; type: string; gender: string;
  featured: boolean; inStock: boolean; active: boolean;
  tags: string[]; images: string[]; topSizes: string[];
  bottomSizes: string[]; colors: ProductColor[];
  createdAt: string; updatedAt: string;
}

export type ProductPayload = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'active'>;

@Injectable({ providedIn: 'root' })
export class ProductsApiService {
  private readonly http = inject(HttpClient);

  getAll() { return this.http.get<Product[]>(`${API_URL}/products`); }
  create(data: ProductPayload) { return this.http.post<Product>(`${API_URL}/products`, data); }
  update(id: string, data: ProductPayload) { return this.http.patch<Product>(`${API_URL}/products/${id}`, data); }
  patchActive(id: string, active: boolean) { return this.http.patch<Product>(`${API_URL}/products/${id}/active`, { active }); }
  patchCollection(id: string, collection: string) { return this.http.patch<Product>(`${API_URL}/products/${id}/collection`, { collection }); }
  remove(id: string) { return this.http.delete(`${API_URL}/products/${id}`); }
}

