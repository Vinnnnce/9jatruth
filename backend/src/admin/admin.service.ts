import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportStatus } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  buildPaginationArgs,
  buildPaginationOrderBy,
  createPaginatedResult,
} from '../common/utils/pagination.util';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const [
      userCount,
      postCount,
      commentCount,
      reactionCount,
      pollCount,
      newsCount,
      reportCount,
      pendingReports,
      factCheckCount,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.post.count(),
      this.prisma.comment.count(),
      this.prisma.reaction.count(),
      this.prisma.poll.count(),
      this.prisma.newsArticle.count(),
      this.prisma.report.count(),
      this.prisma.report.count({ where: { status: 'PENDING' } }),
      this.prisma.factCheckItem.count(),
    ]);

    // Get users by role
    const usersByRole = await this.prisma.user.groupBy({
      by: ['roles'],
      _count: true,
    });

    // Get posts by geo scope
    const postsByGeoScope = await this.prisma.post.groupBy({
      by: ['geoScopeType'],
      _count: true,
    });

    return {
      users: {
        total: userCount,
        byRole: usersByRole,
      },
      posts: {
        total: postCount,
        byGeoScope: postsByGeoScope,
      },
      comments: commentCount,
      reactions: reactionCount,
      polls: pollCount,
      news: newsCount,
      reports: {
        total: reportCount,
        pending: pendingReports,
      },
      factChecks: factCheckCount,
    };
  }

  async getReports(pagination: PaginationDto, status?: ReportStatus) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        ...buildPaginationArgs(pagination),
        where,
        orderBy: buildPaginationOrderBy(pagination, 'createdAt'),
        include: {
          reporter: {
            select: { id: true, name: true, username: true, email: true },
          },
        },
      }),
      this.prisma.report.count({ where }),
    ]);

    return createPaginatedResult(reports, total, pagination);
  }

  async resolveReport(id: string, status: ReportStatus) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new Error('Report not found');

    return this.prisma.report.update({
      where: { id },
      data: { status },
    });
  }

  // Feature toggles (simple in-memory, can be extended to DB)
  private featureToggles: Map<string, boolean> = new Map([
    ['ai_assistant', false],
    ['news_fetch', true],
    ['polls', true],
    ['reactions', true],
  ]);

  getFeatureToggles() {
    return Object.fromEntries(this.featureToggles);
  }

  toggleFeature(feature: string, enabled: boolean) {
    this.featureToggles.set(feature, enabled);
    return { feature, enabled };
  }
}
