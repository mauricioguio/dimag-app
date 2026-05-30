import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { SellerSalesApiService, SellerSale } from '../../../services/seller-sales-api';

// Estados para pedidos FABRICAR (en orden de flujo)
const FABRICAR_STATUSES = ['PENDING', 'PRODUCING', 'READY', 'DELIVERED', 'COMPLETED'];
const ALL_STATUSES = [...FABRICAR_STATUSES, 'CANCELLED'];

@Component({
  selector: 'app-sales',
  templateUrl: './sales.html',
})
export class Sales implements OnInit {
  private readonly api = inject(SellerSalesApiService);

  protected sales = signal<SellerSale[]>([]);
  protected loading = signal(true);
  protected filterType = signal<'ALL' | 'STOCK' | 'FABRICAR'>('ALL');
  protected filterStatus = signal('ALL');
  protected expandedId = signal<string | null>(null);
  protected updatingId = signal<string | null>(null);

  protected readonly fabricarStatuses = FABRICAR_STATUSES;
  protected readonly allStatuses = ALL_STATUSES;

  protected filtered = computed(() => {
    const type = this.filterType();
    const status = this.filterStatus();
    return this.sales()
      .filter(s => {
        if (type !== 'ALL' && s.type !== type) return false;
        if (status !== 'ALL' && s.status !== status) return false;
        return true;
      })
      .sort((a, b) => {
        const aD = a.type === 'FABRICAR' && a.deliveryDate ? new Date(a.deliveryDate).getTime() : null;
        const bD = b.type === 'FABRICAR' && b.deliveryDate ? new Date(b.deliveryDate).getTime() : null;
        if (aD !== null && bD !== null) return aD - bD;
        if (aD !== null) return -1;
        if (bD !== null) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  });

  ngOnInit() {
    this.api.getAll().subscribe({
      next: list => { this.sales.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  updateStatus(sale: SellerSale, status: string) {
    if (sale.status === status) return;
    this.updatingId.set(sale.id);
    this.api.updateStatus(sale.id, status).subscribe({
      next: updated => {
        this.sales.update(list => list.map(s => s.id === updated.id ? updated : s));
        this.updatingId.set(null);
      },
      error: () => this.updatingId.set(null),
    });
  }

  daysUntil(deliveryDate: string | null): number | null {
    if (!deliveryDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(deliveryDate);
    d.setHours(0, 0, 0, 0);
    return Math.ceil((d.getTime() - today.getTime()) / 86400000);
  }

  urgencyBadge(sale: SellerSale): { text: string; cls: string } | null {
    if (sale.type !== 'FABRICAR') return null;
    const days = this.daysUntil(sale.deliveryDate);
    if (days === null) return null;
    if (days <= 0) return { text: 'Vencido', cls: 'bg-red-500/20 text-red-400 border border-red-500/30' };
    if (days === 1) return { text: 'Falta 1 día', cls: 'bg-red-500/20 text-red-400 border border-red-500/30' };
    if (days === 2) return { text: 'Faltan 2 días', cls: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' };
    if (days === 3) return { text: 'Faltan 3 días', cls: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' };
    return null;
  }

  urgencyBorderClass(sale: SellerSale): string {
    if (sale.type !== 'FABRICAR') return 'border-gray-800';
    const days = this.daysUntil(sale.deliveryDate);
    if (days === null) return 'border-gray-800';
    if (days <= 1) return 'border-red-500/50';
    if (days <= 2) return 'border-orange-500/50';
    if (days <= 3) return 'border-yellow-500/50';
    return 'border-gray-800';
  }

  totalPaid(sale: SellerSale): number {
    return sale.payments.reduce((s, p) => s + p.amount, 0);
  }

  formatPrice(v: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  }

  formatDate(iso: string) {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }

  formatDateShort(iso: string) {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(iso));
  }

  statusLabel(s: string) {
    const map: Record<string, string> = {
      PENDING: 'Ingreso',
      PRODUCING: 'Cortado',
      READY: 'Armado sin alistar',
      DELIVERED: 'Listo para enviar',
      COMPLETED: 'En tienda',
      CANCELLED: 'Cancelada',
    };
    return map[s] ?? s;
  }

  statusClass(s: string) {
    if (s === 'PENDING') return 'bg-red-500/10 text-red-400 border-red-500/20';
    if (s === 'PRODUCING') return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    if (s === 'READY') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    if (s === 'DELIVERED') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (s === 'COMPLETED') return 'bg-green-500/10 text-green-400 border-green-500/20';
    if (s === 'CANCELLED') return 'bg-red-500/10 text-red-400 border-red-500/20';
    return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  }

  selectClass(s: string) {
    if (s === 'PENDING') return 'border-red-700 text-red-300 bg-red-500/10';
    if (s === 'PRODUCING') return 'border-orange-700 text-orange-300 bg-orange-500/10';
    if (s === 'READY') return 'border-yellow-700 text-yellow-300 bg-yellow-500/10';
    if (s === 'DELIVERED') return 'border-blue-700 text-blue-300 bg-blue-500/10';
    if (s === 'COMPLETED') return 'border-green-700 text-green-300 bg-green-500/10';
    return 'border-gray-700 text-gray-300 bg-gray-800';
  }
}
