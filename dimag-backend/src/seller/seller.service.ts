import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SellerService {
  constructor(private readonly prisma: PrismaService) {}

  async auth(sedeId: string, pin: string) {
    const sede = await this.prisma.sede.findUnique({ where: { id: sedeId } });
    if (!sede || !sede.pin || sede.pin !== pin) throw new UnauthorizedException('PIN incorrecto');
    return { id: sede.id, name: sede.name };
  }

  getSedes() {
    return this.prisma.sede.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async getInventory(sedeId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { sedeId },
      include: { sede: { select: { id: true, name: true } } },
    });
    const productIds = [...new Set(items.map(i => i.productId))] as string[];
    const products = productIds.length
      ? await this.prisma.product.findMany({ where: { id: { in: productIds }, active: true } })
      : [];
    return { items, products: products.map(p => ({ ...p, type: p.type.toLowerCase() })) };
  }

  getProducts() {
    return this.prisma.product.findMany({ where: { active: true }, orderBy: { name: 'asc' } })
      .then(list => list.map(p => ({ ...p, type: p.type.toLowerCase() })));
  }

  async createSale(sedeId: string, data: {
    type: 'STOCK' | 'FABRICAR';
    customerName?: string;
    notes?: string;
    deliveryDate?: string;
    paymentMethod?: string;
    initialPayment?: number;
    items: { productId: string; productName: string; size: string; quantity: number; price: number; note?: string }[];
  }) {
    if (!data.items?.length) throw new BadRequestException('La venta debe tener al menos un producto');
    const total = data.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const hasAbono = data.initialPayment && data.initialPayment > 0;
    if (hasAbono && data.initialPayment! > total) throw new BadRequestException('El abono no puede exceder el total');

    const status = data.type === 'STOCK' && !hasAbono ? 'COMPLETED' : 'PENDING';
    const itemsData = data.items.map(item => ({
      ...item,
      deliveredQty: data.type === 'STOCK' ? item.quantity : 0,
    }));

    const sale = await this.prisma.sale.create({
      data: {
        sedeId, type: data.type, status, total,
        customerName: data.customerName || null,
        notes: data.notes || null,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        paymentMethod: data.paymentMethod || null,
        items: { create: itemsData },
      },
      include: { items: true, sede: { select: { id: true, name: true } } },
    });

    if (data.type === 'STOCK') {
      for (const item of data.items) {
        await this.prisma.inventoryItem.updateMany({
          where: { sedeId, productId: item.productId, size: item.size },
          data: { quantity: { decrement: item.quantity } },
        });
      }
    }

    if (hasAbono) {
      await this.prisma.salePayment.create({ data: { saleId: sale.id, amount: data.initialPayment! } });
    }

    return sale;
  }

  upsertInventory(sedeId: string, items: { productId: string; size: string; quantity: number }[]) {
    return Promise.all(items.map(item =>
      this.prisma.inventoryItem.upsert({
        where: { sedeId_productId_size: { sedeId, productId: item.productId, size: item.size } },
        update: { quantity: item.quantity },
        create: { sedeId, productId: item.productId, size: item.size, quantity: item.quantity },
      })
    ));
  }

  getSales(sedeId: string) {
    return this.prisma.sale.findMany({
      where: { sedeId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  getAllSales() {
    return this.prisma.sale.findMany({
      include: { items: true, payments: { orderBy: { createdAt: 'asc' } }, sede: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  getFabricarOrders(sedeId: string) {
    return this.prisma.sale.findMany({
      where: {
        sedeId,
        OR: [
          { type: 'FABRICAR', status: { notIn: ['COMPLETED', 'CANCELLED'] } },
          { type: 'STOCK', status: 'PENDING' },
        ],
      },
      include: { items: true, payments: { orderBy: { createdAt: 'asc' } }, sede: { select: { id: true, name: true } } },
      orderBy: [{ deliveryDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  getFabricarOrder(id: string) {
    return this.prisma.sale.findUnique({
      where: { id },
      include: { items: true, payments: { orderBy: { createdAt: 'asc' } }, sede: { select: { id: true, name: true } } },
    });
  }

  async addPayment(saleId: string, amount: number, note?: string) {
    const sale = await this.prisma.sale.findUnique({ where: { id: saleId }, include: { payments: true } });
    if (!sale) throw new BadRequestException('Pedido no encontrado');
    const totalPaid = sale.payments.reduce((s, p) => s + p.amount, 0);
    if (amount <= 0) throw new BadRequestException('El monto debe ser mayor a cero');
    if (amount > sale.total - totalPaid) throw new BadRequestException('El abono no puede exceder el saldo pendiente');
    const payment = await this.prisma.salePayment.create({ data: { saleId, amount, note: note || null } });
    if (totalPaid + amount >= sale.total) {
      await this.prisma.sale.update({ where: { id: saleId }, data: { status: 'COMPLETED' } });
    }
    return payment;
  }

  async updateDeliveredQty(saleId: string, items: { itemId: string; deliveredQty: number }[]) {
    await Promise.all(items.map(({ itemId, deliveredQty }) =>
      this.prisma.saleItem.update({ where: { id: itemId }, data: { deliveredQty } }),
    ));
    return this.getFabricarOrder(saleId);
  }

  async getNextOrderNumber(): Promise<{ nextOrderNumber: number }> {
    const last = await this.prisma.sale.findFirst({ orderBy: { orderNumber: 'desc' }, select: { orderNumber: true } });
    return { nextOrderNumber: (last?.orderNumber ?? 0) + 1 };
  }

  updateSaleStatus(saleId: string, status: string) {
    return this.prisma.sale.update({
      where: { id: saleId },
      data: { status },
      include: { items: true, sede: { select: { id: true, name: true } } },
    });
  }

  deleteSale(id: string) {
    return this.prisma.sale.delete({ where: { id } });
  }
}
