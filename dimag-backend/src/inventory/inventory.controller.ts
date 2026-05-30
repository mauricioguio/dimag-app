import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  findAll() { return this.inventoryService.findAll(); }

  @Put()
  upsert(@Body() body: { sedeId: string; productId: string; size: string; quantity: number }) {
    return this.inventoryService.upsert(body.sedeId, body.productId, body.size, body.quantity);
  }
}
