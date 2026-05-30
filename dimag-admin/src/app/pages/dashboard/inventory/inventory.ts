import { Component, inject, signal, computed } from '@angular/core';
import { SedesApiService, Sede } from '../../../services/sedes-api';
import { InventoryApiService, InventoryItem } from '../../../services/inventory-api';
import { ProductsApiService, Product } from '../../../services/products-api';

function productSizes(p: Product): string[] {
  if (p.type === 'bottom') return p.bottomSizes.length ? p.bottomSizes : ['Único'];
  return p.topSizes.length ? p.topSizes : ['Único'];
}

type StockStatus = 'ok' | 'low' | 'out';

interface ProductCard {
  product: Product;
  total: number;
  status: StockStatus;
}

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.html',
})
export class Inventory {
  private readonly sedesApi = inject(SedesApiService);
  private readonly inventoryApi = inject(InventoryApiService);
  private readonly productsApi = inject(ProductsApiService);

  protected sedes = signal<Sede[]>([]);
  protected products = signal<Product[]>([]);
  protected inventoryItems = signal<InventoryItem[]>([]);
  protected loading = signal(true);

  protected search = signal('');
  protected selectedCollection = signal('all');
  protected showSedesPanel = signal(false);
  protected sedeNameInput = signal('');
  protected editingSedeId = signal<string | null>(null);
  protected deletingSedeId = signal<string | null>(null);
  protected savingSede = signal(false);

  protected editingPinSedeId = signal<string | null>(null);
  protected sedePinInput = signal('');
  protected savingPin = signal(false);

  protected expandedProductId = signal<string | null>(null);
  protected draftQuantities = signal<Record<string, Record<string, number>>>({});
  protected savingDraft = signal(false);

  // ── By-sede view ──
  protected viewMode = signal<'overview' | 'by-sede'>('overview');
  protected selectedSedeId = signal<string | null>(null);
  protected batchDraft = signal<Record<string, Record<string, number>>>({});
  protected savingBatch = signal(false);
  protected batchSaved = signal(false);

  protected productCollections = computed(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const p of this.products()) {
      if (p.collection && !seen.has(p.collection)) {
        seen.add(p.collection);
        result.push(p.collection);
      }
    }
    return result.sort();
  });

  protected filteredProducts = computed(() => {
    const col = this.selectedCollection();
    const q = this.search().toLowerCase();
    return this.products().filter(p => {
      if (col !== 'all' && p.collection !== col) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  protected productCards = computed((): ProductCard[] => {
    return this.filteredProducts().map(p => {
      const sizes = productSizes(p);
      let total = 0;
      for (const size of sizes) {
        for (const sede of this.sedes()) {
          const item = this.inventoryItems().find(
            i => i.productId === p.id && i.size === size && i.sedeId === sede.id,
          );
          total += item?.quantity ?? 0;
        }
      }
      const status: StockStatus = total === 0 ? 'out' : total <= 10 ? 'low' : 'ok';
      return { product: p, total, status };
    });
  });

  protected totalUnits = computed(() =>
    this.productCards().reduce((sum, c) => sum + c.total, 0),
  );

  protected expandedProduct = computed(() => {
    const id = this.expandedProductId();
    return id ? (this.products().find(p => p.id === id) ?? null) : null;
  });

  protected expandedSizes = computed(() => {
    const p = this.expandedProduct();
    return p ? productSizes(p) : [];
  });

  protected selectedSede = computed(() => {
    const id = this.selectedSedeId();
    return id ? this.sedes().find(s => s.id === id) ?? null : null;
  });

  protected batchRows = computed(() =>
    this.filteredProducts().map(p => ({ product: p, sizes: productSizes(p) })),
  );

  protected batchChangesCount = computed(() => {
    const sedeId = this.selectedSedeId();
    if (!sedeId) return 0;
    const draft = this.batchDraft();
    let count = 0;
    for (const [productId, sizeMap] of Object.entries(draft)) {
      for (const [size, qty] of Object.entries(sizeMap)) {
        const current = this.inventoryItems().find(
          i => i.productId === productId && i.size === size && i.sedeId === sedeId,
        )?.quantity ?? 0;
        if (qty !== current) count++;
      }
    }
    return count;
  });

  constructor() { this.loadAll(); }

  private loadAll() {
    this.loading.set(true);
    let pending = 3;
    const done = () => { if (--pending === 0) this.loading.set(false); };
    this.sedesApi.getAll().subscribe({ next: list => { this.sedes.set(list); done(); }, error: done });
    this.productsApi.getAll().subscribe({ next: list => { this.products.set(list); done(); }, error: done });
    this.inventoryApi.getAll().subscribe({ next: list => { this.inventoryItems.set(list); done(); }, error: done });
  }

  openProduct(product: Product) {
    this.expandedProductId.set(product.id);
    const draft: Record<string, Record<string, number>> = {};
    for (const size of productSizes(product)) {
      draft[size] = {};
      for (const sede of this.sedes()) {
        const item = this.inventoryItems().find(
          i => i.productId === product.id && i.size === size && i.sedeId === sede.id,
        );
        draft[size][sede.id] = item?.quantity ?? 0;
      }
    }
    this.draftQuantities.set(draft);
  }

  closeProduct() { this.expandedProductId.set(null); }

  setDraftQty(size: string, sedeId: string, value: number) {
    this.draftQuantities.update(d => ({
      ...d,
      [size]: { ...d[size], [sedeId]: Math.max(0, isNaN(value) ? 0 : value) },
    }));
  }

  saveDraft() {
    const productId = this.expandedProductId();
    if (!productId) return;
    const draft = this.draftQuantities();
    const entries: { size: string; sedeId: string; qty: number }[] = [];
    for (const [size, sedeMap] of Object.entries(draft)) {
      for (const [sedeId, qty] of Object.entries(sedeMap)) {
        entries.push({ size, sedeId, qty });
      }
    }
    if (entries.length === 0) { this.closeProduct(); return; }
    this.savingDraft.set(true);
    let remaining = entries.length;
    const saved: InventoryItem[] = [];
    for (const { size, sedeId, qty } of entries) {
      this.inventoryApi.upsert(sedeId, productId, size, qty).subscribe({
        next: item => {
          saved.push(item);
          if (--remaining === 0) {
            this.inventoryItems.update(items => {
              let list = [...items];
              for (const newItem of saved) {
                const idx = list.findIndex(
                  i => i.productId === newItem.productId && i.size === newItem.size && i.sedeId === newItem.sedeId,
                );
                list = idx >= 0 ? list.map((it, i) => i === idx ? newItem : it) : [...list, newItem];
              }
              return list;
            });
            this.savingDraft.set(false);
            this.closeProduct();
          }
        },
        error: () => { if (--remaining === 0) this.savingDraft.set(false); },
      });
    }
  }

  // ── Sedes CRUD ──

  openAddSede() { this.editingSedeId.set(null); this.sedeNameInput.set(''); }

  openEditSede(sede: Sede) {
    this.editingSedeId.set(sede.id);
    this.sedeNameInput.set(sede.name);
  }

  saveSede() {
    const name = this.sedeNameInput().trim();
    if (!name) return;
    this.savingSede.set(true);
    const id = this.editingSedeId();
    const req = id ? this.sedesApi.update(id, { name }) : this.sedesApi.create(name);
    req.subscribe({
      next: sede => {
        if (id) {
          this.sedes.update(list => list.map(s => s.id === id ? sede : s));
        } else {
          this.sedes.update(list => [...list, sede]);
        }
        this.savingSede.set(false);
        this.sedeNameInput.set('');
        this.editingSedeId.set(null);
      },
      error: () => this.savingSede.set(false),
    });
  }

  openEditPin(sede: Sede) {
    this.editingPinSedeId.set(sede.id);
    this.sedePinInput.set(sede.pin ?? '');
  }

  savePin() {
    const id = this.editingPinSedeId();
    if (!id) return;
    const pin = this.sedePinInput().trim() || null;
    this.savingPin.set(true);
    this.sedesApi.update(id, { pin }).subscribe({
      next: sede => {
        this.sedes.update(list => list.map(s => s.id === id ? sede : s));
        this.savingPin.set(false);
        this.editingPinSedeId.set(null);
        this.sedePinInput.set('');
      },
      error: () => this.savingPin.set(false),
    });
  }

  confirmDeleteSede(id: string) { this.deletingSedeId.set(id); }
  cancelDeleteSede() { this.deletingSedeId.set(null); }

  doDeleteSede(id: string) {
    this.sedesApi.remove(id).subscribe({
      next: () => {
        this.sedes.update(list => list.filter(s => s.id !== id));
        this.inventoryItems.update(items => items.filter(i => i.sedeId !== id));
        this.deletingSedeId.set(null);
      },
    });
  }

  // ── By-sede view ──

  switchToBySedeView() {
    this.viewMode.set('by-sede');
    if (!this.selectedSedeId() && this.sedes().length > 0) {
      this.selectSede(this.sedes()[0].id);
    }
  }

  selectSede(sedeId: string) {
    this.selectedSedeId.set(sedeId);
    this.batchSaved.set(false);
    const draft: Record<string, Record<string, number>> = {};
    for (const p of this.products()) {
      draft[p.id] = {};
      for (const size of productSizes(p)) {
        const item = this.inventoryItems().find(
          i => i.productId === p.id && i.size === size && i.sedeId === sedeId,
        );
        draft[p.id][size] = item?.quantity ?? 0;
      }
    }
    this.batchDraft.set(draft);
  }

  setBatchQty(productId: string, size: string, value: number) {
    this.batchDraft.update(d => ({
      ...d,
      [productId]: { ...d[productId], [size]: Math.max(0, isNaN(value) ? 0 : value) },
    }));
  }

  draftTotalForProduct(productId: string, sizes: string[]): number {
    const draft = this.batchDraft();
    return sizes.reduce((sum, size) => sum + (draft[productId]?.[size] ?? 0), 0);
  }

  protected batchSizeTotals = computed((): { size: string; total: number }[] => {
    const draft = this.batchDraft();
    const totalsMap: Record<string, number> = {};
    const order: string[] = [];
    for (const row of this.batchRows()) {
      for (const size of row.sizes) {
        if (!(size in totalsMap)) { totalsMap[size] = 0; order.push(size); }
        totalsMap[size] += draft[row.product.id]?.[size] ?? 0;
      }
    }
    return order.map(size => ({ size, total: totalsMap[size] }));
  });

  protected batchGrandTotal = computed(() =>
    this.batchSizeTotals().reduce((sum, e) => sum + e.total, 0)
  );

  protected expandedSizeTotals = computed((): Record<string, number> => {
    const draft = this.draftQuantities();
    const sedes = this.sedes();
    const result: Record<string, number> = {};
    for (const size of this.expandedSizes()) {
      result[size] = sedes.reduce((s, sede) => s + (draft[size]?.[sede.id] ?? 0), 0);
    }
    return result;
  });

  protected expandedGrandTotal = computed(() =>
    Object.values(this.expandedSizeTotals()).reduce((sum, v) => sum + v, 0)
  );

  saveBatch() {
    const sedeId = this.selectedSedeId();
    if (!sedeId) return;
    const draft = this.batchDraft();
    const entries: { productId: string; size: string; qty: number }[] = [];
    for (const [productId, sizeMap] of Object.entries(draft)) {
      for (const [size, qty] of Object.entries(sizeMap)) {
        const current = this.inventoryItems().find(
          i => i.productId === productId && i.size === size && i.sedeId === sedeId,
        )?.quantity ?? 0;
        if (qty !== current) entries.push({ productId, size, qty });
      }
    }
    if (entries.length === 0) return;
    this.savingBatch.set(true);
    this.batchSaved.set(false);
    let remaining = entries.length;
    const saved: InventoryItem[] = [];
    for (const { productId, size, qty } of entries) {
      this.inventoryApi.upsert(sedeId, productId, size, qty).subscribe({
        next: item => {
          saved.push(item);
          if (--remaining === 0) {
            this.inventoryItems.update(items => {
              let list = [...items];
              for (const newItem of saved) {
                const idx = list.findIndex(
                  i => i.productId === newItem.productId && i.size === newItem.size && i.sedeId === newItem.sedeId,
                );
                list = idx >= 0 ? list.map((it, i) => i === idx ? newItem : it) : [...list, newItem];
              }
              return list;
            });
            this.savingBatch.set(false);
            this.batchSaved.set(true);
            setTimeout(() => this.batchSaved.set(false), 3000);
          }
        },
        error: () => { if (--remaining === 0) this.savingBatch.set(false); },
      });
    }
  }
}
