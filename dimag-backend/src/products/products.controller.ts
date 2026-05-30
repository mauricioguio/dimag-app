import {
  Controller, Get, Post, Patch, Delete, Param, Body, HttpCode, UseGuards, Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly config: ConfigService,
  ) {}

  @Post('size-advice')
  @HttpCode(200)
  getSizeAdvice(@Body() dto: any) {
    return this.productsService.getSizeAdvice(dto);
  }

  @Get()
  findAll(@Req() req: any) {
    const isAdmin = req.headers['x-admin-key'] === this.config.get<string>('ADMIN_API_KEY');
    return this.productsService.findAll(!isAdmin);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  create(@Body() data: any) {
    return this.productsService.create(data);
  }

  @Patch(':id/active')
  @UseGuards(JwtAuthGuard)
  patchActive(@Param('id') id: string, @Body('active') active: boolean) {
    return this.productsService.patchActive(id, active);
  }

  @Patch(':id/collection')
  @UseGuards(JwtAuthGuard)
  patchCollection(@Param('id') id: string, @Body('collection') collection: string) {
    return this.productsService.patchCollection(id, collection);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() data: any) {
    return this.productsService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
