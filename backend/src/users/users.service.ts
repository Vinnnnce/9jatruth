import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  buildPaginationArgs,
  buildPaginationOrderBy,
  createPaginatedResult,
} from '../common/utils/pagination.util';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(pagination: PaginationDto) {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        ...buildPaginationArgs(pagination),
        orderBy: buildPaginationOrderBy(pagination, 'createdAt'),
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          phone: true,
          roles: true,
          avatarUrl: true,
          bio: true,
          verificationStatus: true,
          countryId: true,
          stateId: true,
          lgaId: true,
          wardId: true,
          communityId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count(),
    ]);

    return createPaginatedResult(users, total, pagination);
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        roles: true,
        avatarUrl: true,
        bio: true,
        verificationStatus: true,
        countryId: true,
        stateId: true,
        lgaId: true,
        wardId: true,
        communityId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        roles: true,
        avatarUrl: true,
        bio: true,
        verificationStatus: true,
        countryId: true,
        stateId: true,
        lgaId: true,
        wardId: true,
        communityId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (dto.username && dto.username !== existing.username) {
      const conflict = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (conflict) {
        throw new ConflictException('Username already taken');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        username: dto.username,
        avatarUrl: dto.avatarUrl,
        bio: dto.bio,
        roles: dto.roles,
        verificationStatus: dto.verificationStatus,
        countryId: dto.countryId,
        stateId: dto.stateId,
        lgaId: dto.lgaId,
        wardId: dto.wardId,
        communityId: dto.communityId,
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        roles: true,
        avatarUrl: true,
        bio: true,
        verificationStatus: true,
        countryId: true,
        stateId: true,
        lgaId: true,
        wardId: true,
        communityId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          { username: dto.username },
          ...(dto.phone ? [{ phone: dto.phone }] : []),
        ],
      },
    });

    if (existing) {
      throw new ConflictException('User with this email, username, or phone already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        name: dto.name,
        username: dto.username,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        roles: dto.roles || [],
        verificationStatus: dto.verificationStatus,
        countryId: dto.countryId,
        stateId: dto.stateId,
        lgaId: dto.lgaId,
        wardId: dto.wardId,
        communityId: dto.communityId,
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        roles: true,
        avatarUrl: true,
        bio: true,
        verificationStatus: true,
        createdAt: true,
      },
    });
  }

  async delete(id: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully' };
  }
}
