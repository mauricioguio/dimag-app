import { Component, inject, signal, computed } from '@angular/core';
import { ProductsApiService, Product, ProductPayload } from '../../../services/products-api';
import { CollectionsApiService, Collection } from '../../../services/collections-api';
import { CloudinaryService } from '../../../services/cloudinary';

const SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];

const PREDEFINED_COLORS: { name: string; hex: string }[] = [
  { name: 'Palo Rosa',       hex: '#e8b5be' },
  { name: 'Azul Rey',        hex: '#3554b7' },
  { name: 'Vinotinto',       hex: '#7a1e2d' },
  { name: 'Beige',           hex: '#e1d5d5' },
  { name: 'Turquesa',        hex: '#378db6' },
  { name: 'Verde Hoja Seca', hex: '#bdced6' },
  { name: 'Gris Perla',      hex: '#d4d7e6' },
  { name: 'Azul Oscuro',     hex: '#212e51' },
  { name: 'Verde Petróleo',  hex: '#2e6d89' },
  { name: 'Blanco',          hex: '#ffffff' },
  { name: 'Negro',           hex: '#000000' },
  { name: 'Lila',            hex: '#c1b3d4' },
  { name: 'Verde Jade',      hex: '#1f5e70' },
  { name: 'Rojo',            hex: '#c20423' },
  { name: 'Berengena',       hex: '#470123' },
  { name: 'Azul Cielo',      hex: '#70afe4' },
  { name: 'Gris Ratón',      hex: '#463e49' },
  { name: 'Verde Oliva',     hex: '#4a4726' },
  { name: 'Verde Militar',   hex: '#4a4726' },
  { name: 'Verde Menta',     hex: '#abd8dd' },
  { name: 'Morado',          hex: '#b13bab' },
  { name: 'Fucsia',          hex: '#ed0085' },
];

function defaultSizes(gender: string): string[] {
  return gender === 'hombre' ? ['XS', 'S', 'M', 'L', 'XL', 'XXL'] : ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];
}

interface Draft {
  name: string;
  collection: string;
  price: number;
  description: string;
  type: string;
  gender: string;
  featured: boolean;
  inStock: boolean;
  tagInput: string;
  topSizes: string[];
  bottomSizes: string[];
  images: string[];
  colors: { name: string; hex: string }[];
}

const emptyDraft = (): Draft => {
  const sizes = defaultSizes('mujer');
  return {
    name: '', collection: '', price: 0, description: '',
    type: 'conjunto', gender: 'mujer',
    featured: false, inStock: true,
    tagInput: '',
    topSizes: sizes, bottomSizes: sizes,
    images: [''],
    colors: [],
  };
};

@Component({
  selector: 'app-products',
  templateUrl: './products.html',
})
export class Products {
  private readonly api = inject(ProductsApiService);
  private readonly collectionsApi = inject(CollectionsApiService);
  private readonly cloudinary = inject(CloudinaryService);

  protected readonly SIZES = SIZES;
  protected products = signal<Product[]>([]);
  protected loading = signal(true);
  protected saving = signal(false);
  protected search = signal('');
  protected selectedCollection = signal('all');
  protected showForm = signal(false);
  protected editingId = signal<string | null>(null);
  protected deletingId = signal<string | null>(null);
  protected draft = signal<Draft>(emptyDraft());
  protected uploadingIndex = signal<number | null>(null);
  protected priceInput = signal('');
  protected collections = signal<Collection[]>([]);
  protected readonly PREDEFINED_COLORS = PREDEFINED_COLORS;
  protected selectedPresetName = signal('');
  protected selectedPreset = computed(() =>
    PREDEFINED_COLORS.find(c => c.name === this.selectedPresetName()) ?? null
  );

  protected productCollections = computed(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const p of this.products()) {
      if (!seen.has(p.collection)) {
        seen.add(p.collection);
        result.push(p.collection);
      }
    }
    return result.sort();
  });

  protected filtered = computed(() => {
    const q = this.search().toLowerCase();
    const col = this.selectedCollection();
    return this.products().filter(p => {
      if (col !== 'all' && p.collection !== col) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  constructor() {
    this.load();
    this.collectionsApi.getAll().subscribe({
      next: list => this.collections.set(list),
    });
  }

  load() {
    this.loading.set(true);
    this.api.getAll().subscribe({
      next: list => { this.products.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private formatCOP(value: number) {
    return value > 0 ? new Intl.NumberFormat('es-CO').format(value) : '';
  }

  onPriceInput(raw: string) {
    const digits = raw.replace(/\D/g, '');
    this.priceInput.set(raw);
    this.patchDraft({ price: +digits || 0 });
  }

  onPriceFocus() {
    const p = this.draft().price;
    this.priceInput.set(p > 0 ? p.toString() : '');
  }

  onPriceBlur() {
    this.priceInput.set(this.formatCOP(this.draft().price));
  }

  openCreate() {
    this.editingId.set(null);
    this.draft.set(emptyDraft());
    this.priceInput.set('');
    this.showForm.set(true);
  }

  openEdit(p: Product) {
    this.editingId.set(p.id);
    this.priceInput.set(this.formatCOP(p.price));
    const sizes = p.type === 'conjunto' && p.topSizes.length === 0
      ? defaultSizes(p.gender)
      : [...p.topSizes];
    this.draft.set({
      name: p.name,
      collection: p.collection,
      price: p.price,
      description: p.description,
      type: p.type,
      gender: p.gender,
      featured: p.featured,
      inStock: p.inStock,
      tagInput: p.tags.join(', '),
      topSizes: sizes,
      bottomSizes: p.type === 'conjunto' && p.bottomSizes.length === 0 ? sizes : [...p.bottomSizes],
      images: p.images.length ? [...p.images] : [''],
      colors: p.colors ? [...p.colors] : [],
    });
    this.selectedPresetName.set('');
    this.autoDetectColors();
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  save() {
    const d = this.draft();
    const payload: ProductPayload = {
      name: d.name,
      collection: d.collection,
      price: d.price,
      description: d.description,
      type: d.type,
      gender: d.gender,
      featured: d.featured,
      inStock: d.inStock,
      tags: d.tagInput.split(',').map(t => t.trim()).filter(Boolean),
      topSizes: d.topSizes,
      bottomSizes: d.bottomSizes,
      colors: d.colors,
      images: d.images.filter(i => i),
    };
    this.saving.set(true);
    const id = this.editingId();
    const req = id ? this.api.update(id, payload) : this.api.create(payload);
    req.subscribe({
      next: product => {
        if (id) {
          this.products.update(list => list.map(p => p.id === id ? product : p));
        } else {
          this.products.update(list => [product, ...list]);
        }
        this.saving.set(false);
        this.closeForm();
      },
      error: () => this.saving.set(false),
    });
  }

  toggleActive(product: Product) {
    this.api.patchActive(product.id, !product.active).subscribe({
      next: updated => {
        this.products.update(list => list.map(p => p.id === updated.id ? updated : p));
      },
    });
  }

  confirmDelete(id: string) { this.deletingId.set(id); }
  cancelDelete() { this.deletingId.set(null); }

  doDelete(id: string) {
    this.api.remove(id).subscribe({
      next: () => {
        this.products.update(list => list.filter(p => p.id !== id));
        this.deletingId.set(null);
        if (this.editingId() === id) this.closeForm();
      },
    });
  }

  patchDraft(patch: Partial<Draft>) {
    this.draft.update(d => ({ ...d, ...patch }));
    if ('name' in patch) this.autoDetectColors();
  }

  private autoDetectColors() {
    const nameLower = this.draft().name.toLowerCase();
    const match = PREDEFINED_COLORS.find(c =>
      nameLower.includes(c.name.toLowerCase())
    );
    if (match) this.selectedPresetName.set(match.name);
  }

  onTypeChange(type: string) {
    this.draft.update(d => {
      const sizes = type === 'conjunto' ? defaultSizes(d.gender) : [];
      return { ...d, type, topSizes: sizes, bottomSizes: sizes };
    });
  }

  onGenderChange(gender: string) {
    this.draft.update(d => {
      if (d.type !== 'conjunto') return { ...d, gender };
      const sizes = defaultSizes(gender);
      return { ...d, gender, topSizes: sizes, bottomSizes: sizes };
    });
  }

  // Para conjuntos: blusa y pantalón comparten las mismas tallas disponibles.
  // El cliente elige tallas distintas solo al momento del pedido.
  toggleConjuntoSize(size: string) {
    this.draft.update(d => {
      const sizes = d.topSizes.includes(size)
        ? d.topSizes.filter(s => s !== size)
        : [...d.topSizes, size];
      return { ...d, topSizes: sizes, bottomSizes: sizes };
    });
  }

  toggleTopSize(size: string) {
    this.draft.update(d => ({
      ...d,
      topSizes: d.topSizes.includes(size)
        ? d.topSizes.filter(s => s !== size)
        : [...d.topSizes, size],
    }));
  }

  toggleBottomSize(size: string) {
    this.draft.update(d => ({
      ...d,
      bottomSizes: d.bottomSizes.includes(size)
        ? d.bottomSizes.filter(s => s !== size)
        : [...d.bottomSizes, size],
    }));
  }

  addColor() {
    const preset = this.selectedPreset();
    if (!preset) return;
    if (this.draft().colors.some(c => c.name === preset.name)) return;
    this.draft.update(d => ({ ...d, colors: [...d.colors, preset] }));
    this.selectedPresetName.set('');
  }

  removeColor(i: number) {
    this.draft.update(d => ({ ...d, colors: d.colors.filter((_, idx) => idx !== i) }));
  }

  addImage() {
    this.draft.update(d => ({ ...d, images: [...d.images, ''] }));
  }

  removeImage(i: number) {
    this.draft.update(d => ({ ...d, images: d.images.filter((_, idx) => idx !== i) }));
  }

  setImage(i: number, url: string) {
    this.draft.update(d => {
      const images = d.images.map((img, idx) => idx === i ? url : img);
      return { ...d, images };
    });
  }

  uploadImage(i: number, event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadingIndex.set(i);
    this.cloudinary.upload(file).subscribe({
      next: url => {
        this.setImage(i, url);
        this.uploadingIndex.set(null);
      },
      error: () => this.uploadingIndex.set(null),
    });
  }

  uploadMultiple(event: Event) {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    if (!files.length) return;
    this.uploadingIndex.set(-1);
    let completed = 0;
    files.forEach(file => {
      this.cloudinary.upload(file).subscribe({
        next: url => {
          this.draft.update(d => {
            const images = d.images.filter(i => i);
            return { ...d, images: [...images, url] };
          });
          completed++;
          if (completed === files.length) this.uploadingIndex.set(null);
        },
        error: () => {
          completed++;
          if (completed === files.length) this.uploadingIndex.set(null);
        },
      });
    });
  }

  canSave(): boolean {
    const d = this.draft();
    return !!(d.name && d.collection && d.price > 0);
  }

  typeLabel(type: string) {
    return ({ conjunto: 'Conjunto', top: 'Blusa', bottom: 'Pantalón', otro: 'Otro' } as Record<string, string>)[type] ?? type;
  }

  typeBadge(type: string) {
    return ({
      conjunto: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
      top: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
      bottom: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
      otro: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
    } as Record<string, string>)[type] ?? '';
  }

  formatPrice(value: number) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0,
    }).format(value);
  }
}
