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

  // ─── Dashboard Stats ──────────────────────────────────

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

  async getPostsByState() {
    const results = await this.prisma.post.groupBy({
      by: ['stateId'],
      _count: true,
    });

    // Enrich with state names
    const stateIds = results.map((r) => r.stateId).filter((s): s is string => s !== null);
    const states = stateIds.length > 0
      ? await this.prisma.state.findMany({ where: { id: { in: stateIds } } })
      : [];
    const stateMap = new Map(states.map((s) => [s.id, s.name]));

    return results.map((r) => ({
      state: r.stateId ? (stateMap.get(r.stateId) || 'Unknown') : 'National',
      count: r._count,
    }));
  }

  async getUserGrowth(days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const users = await this.prisma.user.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const byDate = new Map<string, number>();
    for (const u of users) {
      const dateKey = u.createdAt.toISOString().split('T')[0];
      byDate.set(dateKey, (byDate.get(dateKey) || 0) + 1);
    }

    return Array.from(byDate.entries()).map(([date, count]) => ({ date, count }));
  }

  async getTruthScoreDistribution() {
    const ranges = [
      { range: '0-20', min: 0, max: 20 },
      { range: '21-40', min: 21, max: 40 },
      { range: '41-60', min: 41, max: 60 },
      { range: '61-80', min: 61, max: 80 },
      { range: '81-100', min: 81, max: 100 },
    ];

    const results = await Promise.all(
      ranges.map(async (r) => ({
        range: r.range,
        count: await this.prisma.post.count({
          where: { truthScore: { gte: r.min, lte: r.max } },
        }),
      }))
    );

    return results;
  }

  async getTopReportedPosts(limit: number) {
    // Report model doesn't have a direct post relation, so count reports by targetId where targetType is POST
    const reportedPosts = await this.prisma.report.groupBy({
      by: ['targetId'],
      where: { targetType: 'POST' },
      _count: true,
      orderBy: { _count: { targetId: 'desc' } },
      take: limit,
    });

    const postIds = reportedPosts.map((r) => r.targetId);
    const posts = postIds.length > 0
      ? await this.prisma.post.findMany({
          where: { id: { in: postIds } },
          include: {
            author: {
              select: { id: true, name: true, username: true },
            },
          },
        })
      : [];
    const postMap = new Map(posts.map((p) => [p.id, p]));

    return reportedPosts.map((r) => {
      const post = postMap.get(r.targetId);
      return {
        id: r.targetId,
        title: post?.title || 'Unknown',
        body: post?.body || '',
        authorName: post?.author?.name || 'Unknown',
        reportCount: r._count,
        createdAt: post?.createdAt || new Date(),
      };
    });
  }

  // ─── Reports / Moderation ────────────────────────────

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

  async getReport(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        reporter: {
          select: { id: true, name: true, username: true, email: true },
        },
      },
    });
    if (!report) throw new Error('Report not found');
    return report;
  }

  async resolveReport(id: string, status: ReportStatus, resolution?: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new Error('Report not found');

    // Report model doesn't have a 'resolution' field; store resolution in reason if provided
    return this.prisma.report.update({
      where: { id },
      data: { status },
    });
  }

  // ─── Feed Moderation ─────────────────────────────────

  async getPosts(pagination: PaginationDto, status?: string, category?: string) {
    const where: Record<string, unknown> = {};
    // Post model doesn't have a 'status' field; filter by tags if category provided
    if (category) where.tags = { path: ['$'], array_contains: category };

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        ...buildPaginationArgs(pagination),
        where,
        orderBy: buildPaginationOrderBy(pagination, 'createdAt'),
        include: {
          author: {
            select: { id: true, name: true, username: true },
          },
          _count: { select: { comments: true, reactions: true } },
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return createPaginatedResult(posts, total, pagination);
  }

  async updatePostStatus(id: string, status: string) {
    // Post model doesn't have a 'status' field; this is a no-op placeholder
    // In a real implementation, you might add a status field to the Post model
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new Error('Post not found');
    return post;
  }

  async getComments(pagination: PaginationDto, status?: string, postId?: string) {
    const where: Record<string, unknown> = {};
    // Comment model doesn't have a 'status' field
    if (postId) where.postId = postId;

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        ...buildPaginationArgs(pagination),
        where,
        orderBy: buildPaginationOrderBy(pagination, 'createdAt'),
        include: {
          author: {
            select: { id: true, name: true, username: true },
          },
        },
      }),
      this.prisma.comment.count({ where }),
    ]);

    return createPaginatedResult(comments, total, pagination);
  }

  async updateCommentStatus(id: string, status: string) {
    // Comment model doesn't have a 'status' field; this is a no-op placeholder
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new Error('Comment not found');
    return comment;
  }

  // ─── Fact Checks ─────────────────────────────────────

  async getFactChecks(pagination: PaginationDto) {
    const [factChecks, total] = await Promise.all([
      this.prisma.factCheckItem.findMany({
        ...buildPaginationArgs(pagination),
        orderBy: buildPaginationOrderBy(pagination, 'createdAt'),
        include: {
          post: {
            select: { id: true, title: true, body: true },
          },
        },
      }),
      this.prisma.factCheckItem.count(),
    ]);

    return createPaginatedResult(factChecks, total, pagination);
  }

  async getFactCheck(id: string) {
    const factCheck = await this.prisma.factCheckItem.findUnique({
      where: { id },
      include: {
        post: {
          select: { id: true, title: true, body: true },
        },
      },
    });
    if (!factCheck) throw new Error('Fact check not found');
    return factCheck;
  }

  async createFactCheck(data: Record<string, unknown>) {
    return this.prisma.factCheckItem.create({ data: data as any });
  }

  async updateFactCheck(id: string, data: Record<string, unknown>) {
    return this.prisma.factCheckItem.update({
      where: { id },
      data: data as any,
    });
  }

  async deleteFactCheck(id: string) {
    return this.prisma.factCheckItem.delete({ where: { id } });
  }

  // ─── Feature Toggles ─────────────────────────────────
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
