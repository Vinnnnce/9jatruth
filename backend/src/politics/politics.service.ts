import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartyDto } from './dto/create-party.dto';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { CreateOfficeDto } from './dto/create-office.dto';
import { CreateElectionDto } from './dto/create-election.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  buildPaginationArgs,
  buildPaginationOrderBy,
  createPaginatedResult,
} from '../common/utils/pagination.util';

@Injectable()
export class PoliticsService {
  constructor(private prisma: PrismaService) {}

  // ─── Parties ──────────────────────────────────────────
  async findParties(pagination: PaginationDto) {
    const [parties, total] = await Promise.all([
      this.prisma.party.findMany({
        ...buildPaginationArgs(pagination),
        orderBy: buildPaginationOrderBy(pagination, 'createdAt'),
        include: { _count: { select: { candidates: true } } },
      }),
      this.prisma.party.count(),
    ]);
    return createPaginatedResult(parties, total, pagination);
  }

  async findPartyById(id: string) {
    const party = await this.prisma.party.findUnique({
      where: { id },
      include: { candidates: { include: { office: true } } },
    });
    if (!party) throw new NotFoundException('Party not found');
    return party;
  }

  async createParty(dto: CreatePartyDto) {
    return this.prisma.party.create({
      data: {
        name: dto.name,
        acronym: dto.acronym,
        logoUrl: dto.logoUrl,
        ideology: dto.ideology,
        regionFocus: dto.regionFocus,
      },
    });
  }

  async updateParty(id: string, dto: Partial<CreatePartyDto>) {
    const existing = await this.prisma.party.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Party not found');
    return this.prisma.party.update({
      where: { id },
      data: {
        name: dto.name,
        acronym: dto.acronym,
        logoUrl: dto.logoUrl,
        ideology: dto.ideology,
        regionFocus: dto.regionFocus,
      },
    });
  }

  async deleteParty(id: string) {
    const existing = await this.prisma.party.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Party not found');
    await this.prisma.party.delete({ where: { id } });
    return { message: 'Party deleted successfully' };
  }

  // ─── Candidates ───────────────────────────────────────
  async findCandidates(pagination: PaginationDto) {
    const [candidates, total] = await Promise.all([
      this.prisma.candidate.findMany({
        ...buildPaginationArgs(pagination),
        orderBy: buildPaginationOrderBy(pagination, 'createdAt'),
        include: {
          party: { select: { name: true, acronym: true, logoUrl: true } },
          office: { select: { name: true, level: true } },
        },
      }),
      this.prisma.candidate.count(),
    ]);
    return createPaginatedResult(candidates, total, pagination);
  }

  async findCandidateById(id: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id },
      include: {
        party: true,
        office: true,
      },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');
    return candidate;
  }

  async createCandidate(dto: CreateCandidateDto) {
    return this.prisma.candidate.create({
      data: {
        name: dto.name,
        partyId: dto.partyId,
        officeId: dto.officeId,
        bio: dto.bio,
        manifesto: dto.manifesto,
        mediaLinks: dto.mediaLinks,
      },
      include: { party: true, office: true },
    });
  }

  async updateCandidate(id: string, dto: Partial<CreateCandidateDto>) {
    const existing = await this.prisma.candidate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Candidate not found');
    return this.prisma.candidate.update({
      where: { id },
      data: {
        name: dto.name,
        partyId: dto.partyId,
        officeId: dto.officeId,
        bio: dto.bio,
        manifesto: dto.manifesto,
        mediaLinks: dto.mediaLinks,
      },
    });
  }

  async deleteCandidate(id: string) {
    const existing = await this.prisma.candidate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Candidate not found');
    await this.prisma.candidate.delete({ where: { id } });
    return { message: 'Candidate deleted successfully' };
  }

  // ─── Offices ──────────────────────────────────────────
  async findOffices() {
    return this.prisma.office.findMany({
      include: { _count: { select: { candidates: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createOffice(dto: CreateOfficeDto) {
    return this.prisma.office.create({
      data: { name: dto.name, level: dto.level },
    });
  }

  async updateOffice(id: string, dto: Partial<CreateOfficeDto>) {
    const existing = await this.prisma.office.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Office not found');
    return this.prisma.office.update({
      where: { id },
      data: { name: dto.name, level: dto.level },
    });
  }

  async deleteOffice(id: string) {
    const existing = await this.prisma.office.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Office not found');
    await this.prisma.office.delete({ where: { id } });
    return { message: 'Office deleted successfully' };
  }

  // ─── Elections ────────────────────────────────────────
  async findElections(pagination: PaginationDto) {
    const [elections, total] = await Promise.all([
      this.prisma.election.findMany({
        ...buildPaginationArgs(pagination),
        orderBy: buildPaginationOrderBy(pagination, 'date'),
      }),
      this.prisma.election.count(),
    ]);
    return createPaginatedResult(elections, total, pagination);
  }

  async findElectionById(id: string) {
    const election = await this.prisma.election.findUnique({ where: { id } });
    if (!election) throw new NotFoundException('Election not found');
    return election;
  }

  async createElection(dto: CreateElectionDto) {
    return this.prisma.election.create({
      data: {
        name: dto.name,
        date: new Date(dto.date),
        level: dto.level,
        geoScope: dto.geoScope,
        officesInvolved: dto.officesInvolved,
        status: dto.status,
      },
    });
  }

  async updateElection(id: string, dto: Partial<CreateElectionDto>) {
    const existing = await this.prisma.election.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Election not found');
    return this.prisma.election.update({
      where: { id },
      data: {
        name: dto.name,
        date: dto.date ? new Date(dto.date) : undefined,
        level: dto.level,
        geoScope: dto.geoScope,
        officesInvolved: dto.officesInvolved,
        status: dto.status,
      },
    });
  }

  async deleteElection(id: string) {
    const existing = await this.prisma.election.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Election not found');
    await this.prisma.election.delete({ where: { id } });
    return { message: 'Election deleted successfully' };
  }
}
