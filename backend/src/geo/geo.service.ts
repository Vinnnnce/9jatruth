import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GeoService {
  constructor(private prisma: PrismaService) {}

  async findCountries() {
    return this.prisma.country.findMany({
      include: { _count: { select: { states: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findStates(countryId?: string) {
    return this.prisma.state.findMany({
      where: countryId ? { countryId } : undefined,
      include: {
        country: { select: { name: true, code: true } },
        _count: { select: { lgas: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findStateById(id: string) {
    return this.prisma.state.findUnique({
      where: { id },
      include: {
        country: true,
        lgas: { orderBy: { name: 'asc' } },
      },
    });
  }

  async findLgasByState(stateId: string) {
    return this.prisma.lGA.findMany({
      where: { stateId },
      include: {
        state: { select: { name: true } },
        _count: { select: { wards: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findLgaById(id: string) {
    return this.prisma.lGA.findUnique({
      where: { id },
      include: {
        state: true,
        wards: { orderBy: { name: 'asc' } },
      },
    });
  }

  async findWardsByLga(lgaId: string) {
    return this.prisma.ward.findMany({
      where: { lgaId },
      include: {
        lga: { select: { name: true } },
        _count: { select: { communities: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findWardById(id: string) {
    return this.prisma.ward.findUnique({
      where: { id },
      include: {
        lga: true,
        communities: { orderBy: { name: 'asc' } },
      },
    });
  }

  async findCommunitiesByWard(wardId: string) {
    return this.prisma.community.findMany({
      where: { wardId },
      include: {
        ward: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }
}
