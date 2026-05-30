import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { SedesModule } from './sedes/sedes.module';
import { InventoryModule } from './inventory/inventory.module';
import { SellerModule } from './seller/seller.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    ProductsModule,
    SedesModule,
    InventoryModule,
    SellerModule,
  ],
})
export class AppModule {}
