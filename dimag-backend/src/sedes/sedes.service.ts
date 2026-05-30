import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SedesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.sede.findMany({ orderBy: { name: 'asc' } });
  }

  create(data: { name: string }) {
    return this.prisma.sede.create({ data });
  }

  update(id: string, data: { name?: string; active?: boolean; pin?: string | null }) {
    return this.prisma.sede.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.prisma.sede.delete({ where: { id } });
    return { deleted: true };
  }
}
