import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '@prisma/client';
import { JwtPayload } from './strategies/jwt.strategy';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    username: string;
    email: string;
    roles: Role[];
  };
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
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

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        username: dto.username,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        roles: [Role.USER],
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
        roles: true,
      },
    });

    return this.generateTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.emailOrPhone },
          { phone: dto.emailOrPhone },
          { username: dto.emailOrPhone },
        ],
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      roles: user.roles,
    });
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async generateTokens(user: {
    id: string;
    name: string;
    username: string;
    email: string;
    roles: Role[];
  }): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      roles: user.roles as unknown as string[],
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
      }),
    ]);

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        roles: user.roles,
      },
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          roles: true,
          refreshTokenHash: true,
        },
      });

      if (!user || !user.refreshTokenHash) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!isValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return this.generateTokens({
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        roles: user.roles,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }
}
