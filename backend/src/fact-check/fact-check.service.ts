import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFactCheckDto } from './dto/create-fact-check.dto';

@Injectable()
export class FactCheckService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateFactCheckDto) {
    const post = await this.prisma.post.findUnique({
      where: { id: dto.relatedPostId },
    });
    if (!post) throw new NotFoundException('Post not found');

    const factCheck = await this.prisma.factCheckItem.create({
      data: {
        relatedPostId: dto.relatedPostId,
        status: dto.status,
        sources: dto.sources || [],
        summary: dto.summary,
      },
    });

    // Update truth score based on fact check status
    const scoreMap: Record<string, number> = {
      TRUE: 100,
      MIXED: 50,
      FALSE: 0,
      UNVERIFIED: 25,
    };

    const score = scoreMap[dto.status] ?? 25;

    // Upsert truth score
    await this.prisma.truthScore.upsert({
      where: { postId: dto.relatedPostId },
      update: {
        score,
        algorithmMetadata: {
          factCheckStatus: dto.status,
          updatedAt: new Date().toISOString(),
        },
      },
      create: {
        postId: dto.relatedPostId,
        score,
        algorithmMetadata: {
          factCheckStatus: dto.status,
          createdAt: new Date().toISOString(),
        },
      },
    });

    // Update post truthScore field
    await this.prisma.post.update({
      where: { id: dto.relatedPostId },
      data: { truthScore: score },
    });

    return factCheck;
  }

  async findById(id: string) {
    const factCheck = await this.prisma.factCheckItem.findUnique({
      where: { id },
      include: {
        post: {
          select: { id: true, title: true, body: true },
        },
      },
    });
    if (!factCheck) throw new NotFoundException('Fact check not found');
    return factCheck;
  }

  async findByPostId(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });
    if (!post) throw new NotFoundException('Post not found');

    const factChecks = await this.prisma.factCheckItem.findMany({
      where: { relatedPostId: postId },
      orderBy: { createdAt: 'desc' },
    });

    const truthScore = await this.prisma.truthScore.findUnique({
      where: { postId },
    });

    return {
      factChecks,
      truthScore,
      currentScore: post.truthScore,
    };
  }
}
