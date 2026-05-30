import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const items = await this.prisma.inventoryItem.findMany({
      include: { sede: true },
      orderBy: [{ productId: 'asc' }, { size: 'asc' }],
    });
    const productIds = [...new Set(items.map(i => i.productId))];
    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true },
        })
      : [];
    const productMap = new Map(products.map(p => [p.id, p.name]));
    return items.map(i => ({
      ...i,
      productName: productMap.get(i.productId) ?? 'Producto eliminado',
    }));
  }

  upsert(sedeId: string, productId: string, size: string, quantity: number) {
    return this.prisma.inventoryItem.upsert({
      where: { sedeId_productId_size: { sedeId, productId, size } },
      create: { sedeId, productId, size, quantity },
      update: { quantity },
      include: { sede: true },
    });
  }
}
