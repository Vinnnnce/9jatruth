import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FeedService } from './feed.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateReactionDto } from './dto/create-reaction.dto';
import { QueryFeedDto } from './dto/query-feed.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Feed')
@Controller()
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  // ─── Feed listing ─────────────────────────────────────
  @Get('feeds')
  @ApiOperation({ summary: 'Get feed posts with geo filters and pagination' })
  async getFeeds(@Query() query: QueryFeedDto) {
    return this.feedService.findPosts(query);
  }

  // ─── Posts ────────────────────────────────────────────
  @Post('posts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a post' })
  async createPost(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePostDto,
  ) {
    return this.feedService.createPost(user.id, dto);
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Get post by ID with comments and reactions' })
  async getPost(@Param('id') id: string) {
    return this.feedService.findPostById(id);
  }

  @Put('posts/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a post' })
  async updatePost(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: Partial<CreatePostDto>,
  ) {
    return this.feedService.updatePost(id, user.id, dto);
  }

  @Delete('posts/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a post' })
  async deletePost(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.feedService.deletePost(id, user.id);
  }

  // ─── Comments ────────────────────────────────────────
  @Get('posts/:id/comments')
  @ApiOperation({ summary: 'List comments for a post' })
  async getComments(
    @Param('id') postId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.feedService.findComments(postId, pagination);
  }

  @Post('posts/:id/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Add a comment to a post' })
  async addComment(
    @Param('id') postId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommentDto,
  ) {
    return this.feedService.addComment(postId, user.id, dto);
  }

  // ─── Reactions ───────────────────────────────────────
  @Post('posts/:id/reactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Add or update a reaction to a post' })
  async addReaction(
    @Param('id') postId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReactionDto,
  ) {
    return this.feedService.addReaction(postId, user.id, dto);
  }

  @Delete('posts/:id/reactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Remove reaction from a post' })
  async removeReaction(
    @Param('id') postId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.feedService.removeReaction(postId, user.id);
  }

  @Get('posts/:id/reactions/stats')
  @ApiOperation({ summary: 'Get reaction statistics for a post' })
  async getReactionStats(@Param('id') postId: string) {
    return this.feedService.getReactionStats(postId);
  }
}
