import { Component, inject, signal, computed } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { SellerSalesApiService, SellerSale } from '../../../services/seller-sales-api';

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

@Component({
  selector: 'app-overview',
  imports: [CurrencyPipe],
  templateUrl: './overview.html',
})
export class Overview {
  private readonly api = inject(SellerSalesApiService);

  protected sales   = signal<SellerSale[]>([]);
  protected loading = signal(true);
  protected error   = signal(false);

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.api.getAll().subscribe({
      next:  d  => { this.sales.set(d); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

  fmt(v: number) { return COP.format(v); }

  totalHoy = computed(() => {
    const today = new Date().toDateString();
    return this.sales()
      .filter(s => new Date(s.createdAt).toDateString() === today)
      .reduce((sum, s) => sum + s.total, 0);
  });

  totalMes = computed(() => {
    const now = new Date();
    return this.sales()
      .filter(s => {
        const d = new Date(s.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, s) => sum + s.total, 0);
  });

  ventasHoy = computed(() => {
    const today = new Date().toDateString();
    return this.sales().filter(s => new Date(s.createdAt).toDateString() === today).length;
  });

  pendientes = computed(() => this.sales().filter(s => s.status === 'PENDING').length);

  recentSales = computed(() =>
    [...this.sales()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10)
  );
}
