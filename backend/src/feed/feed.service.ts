import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateReactionDto } from './dto/create-reaction.dto';
import { QueryFeedDto } from './dto/query-feed.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  buildPaginationArgs,
  buildPaginationOrderBy,
  createPaginatedResult,
} from '../common/utils/pagination.util';

@Injectable()
export class FeedService {
  constructor(private prisma: PrismaService) {}

  // ─── Posts ────────────────────────────────────────────
  async findPosts(query: QueryFeedDto) {
    const where: Prisma.PostWhereInput = {};

    // Geo scope filtering
    if (query.geoScopeType) {
      where.geoScopeType = query.geoScopeType;
    }
    if (query.stateId) where.stateId = query.stateId;
    if (query.lgaId) where.lgaId = query.lgaId;
    if (query.wardId) where.wardId = query.wardId;
    if (query.communityId) where.communityId = query.communityId;

    // Author filter
    if (query.authorId) where.authorId = query.authorId;

    // Tag filter - JSON field, use string_contains for each tag
    if (query.tags && query.tags.length > 0) {
      where.tags = { string_contains: query.tags[0] };
    }

    // Search
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { body: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        ...buildPaginationArgs(query),
        where,
        orderBy: buildPaginationOrderBy(query, 'createdAt'),
        include: {
          author: {
            select: {
              id: true,
              name: true,
              username: true,
              avatarUrl: true,
              roles: true,
            },
          },
          _count: {
            select: {
              comments: true,
              reactions: true,
            },
          },
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return createPaginatedResult(posts, total, query);
  }

  async findPostById(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            roles: true,
          },
        },
        comments: {
          include: {
            author: {
              select: { id: true, name: true, username: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        reactions: {
          include: {
            user: {
              select: { id: true, name: true, username: true },
            },
          },
        },
        factChecks: true,
        truthScores: true,
      },
    });

    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async createPost(authorId: string, dto: CreatePostDto) {
    return this.prisma.post.create({
      data: {
        authorId,
        geoScopeType: dto.geoScopeType || 'NATIONAL',
        stateId: dto.stateId,
        lgaId: dto.lgaId,
        wardId: dto.wardId,
        communityId: dto.communityId,
        title: dto.title,
        body: dto.body,
        media: (dto.media || {}) as Prisma.InputJsonValue,
        tags: (dto.tags || []) as Prisma.InputJsonValue,
      },
      include: {
        author: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
    });
  }

  async updatePost(id: string, authorId: string, dto: Partial<CreatePostDto>) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId !== authorId) {
      throw new ForbiddenException('You can only edit your own posts');
    }

    return this.prisma.post.update({
      where: { id },
      data: {
        title: dto.title,
        body: dto.body,
        geoScopeType: dto.geoScopeType,
        stateId: dto.stateId,
        lgaId: dto.lgaId,
        wardId: dto.wardId,
        communityId: dto.communityId,
        media: dto.media as Prisma.InputJsonValue,
        tags: dto.tags as Prisma.InputJsonValue,
      },
    });
  }

  async deletePost(id: string, authorId: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');

    // Allow author or admin to delete
    const user = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { roles: true },
    });

    const isAdmin = user?.roles?.some((r) =>
      ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'].includes(r),
    );

    if (post.authorId !== authorId && !isAdmin) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.prisma.post.delete({ where: { id } });
    return { message: 'Post deleted successfully' };
  }

  // ─── Comments ────────────────────────────────────────
  async addComment(postId: string, authorId: string, dto: CreateCommentDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    if (dto.parentCommentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentCommentId },
      });
      if (!parent || parent.postId !== postId) {
        throw new BadRequestException('Invalid parent comment');
      }
    }

    return this.prisma.comment.create({
      data: {
        postId,
        authorId,
        body: dto.body,
        parentCommentId: dto.parentCommentId,
      },
      include: {
        author: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
    });
  }

  async findComments(postId: string, pagination: PaginationDto) {
    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        ...buildPaginationArgs(pagination),
        where: { postId },
        orderBy: buildPaginationOrderBy(pagination, 'createdAt'),
        include: {
          author: {
            select: { id: true, name: true, username: true, avatarUrl: true },
          },
        },
      }),
      this.prisma.comment.count({ where: { postId } }),
    ]);
    return createPaginatedResult(comments, total, pagination);
  }

  // ─── Reactions ───────────────────────────────────────
  async addReaction(postId: string, userId: string, dto: CreateReactionDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    // Upsert: if user already reacted, update the type
    const existing = await this.prisma.reaction.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      return this.prisma.reaction.update({
        where: { postId_userId: { postId, userId } },
        data: { type: dto.type },
      });
    }

    return this.prisma.reaction.create({
      data: { postId, userId, type: dto.type },
    });
  }

  async removeReaction(postId: string, userId: string) {
    await this.prisma.reaction.deleteMany({
      where: { postId, userId },
    });
    return { message: 'Reaction removed' };
  }

  async getReactionStats(postId: string) {
    const reactions = await this.prisma.reaction.groupBy({
      by: ['type'],
      where: { postId },
      _count: true,
    });

    return reactions.reduce((acc, r) => {
      acc[r.type] = r._count;
      return acc;
    }, {} as Record<string, number>);
  }
}
