import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, ReportStatus } from '@prisma/client';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── Dashboard Stats ──────────────────────────────────
  @Get('stats')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MODERATOR)
  @ApiOperation({ summary: 'Get platform statistics' })
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('stats/posts-by-state')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MODERATOR)
  @ApiOperation({ summary: 'Get posts grouped by state' })
  async getPostsByState() {
    return this.adminService.getPostsByState();
  }

  @Get('stats/user-growth')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get user growth over time' })
  async getUserGrowth(@Query('days') days?: number) {
    return this.adminService.getUserGrowth(days || 30);
  }

  @Get('stats/truth-score-distribution')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MODERATOR)
  @ApiOperation({ summary: 'Get truth score distribution' })
  async getTruthScoreDistribution() {
    return this.adminService.getTruthScoreDistribution();
  }

  @Get('stats/top-reported-posts')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MODERATOR)
  @ApiOperation({ summary: 'Get most reported posts' })
  async getTopReportedPosts(@Query('limit') limit?: number) {
    return this.adminService.getTopReportedPosts(limit || 10);
  }

  // ─── Reports / Moderation ────────────────────────────
  @Get('reports')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MODERATOR)
  @ApiOperation({ summary: 'List reports' })
  async getReports(
    @Query() pagination: PaginationDto,
    @Query('status') status?: ReportStatus,
  ) {
    return this.adminService.getReports(pagination, status);
  }

  @Get('reports/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MODERATOR)
  @ApiOperation({ summary: 'Get report by ID' })
  async getReport(@Param('id') id: string) {
    return this.adminService.getReport(id);
  }

  @Put('reports/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Resolve a report' })
  async resolveReport(
    @Param('id') id: string,
    @Body() body: { status: ReportStatus; resolution?: string },
  ) {
    return this.adminService.resolveReport(id, body.status, body.resolution);
  }

  // ─── Feed Moderation ─────────────────────────────────
  @Get('posts')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MODERATOR)
  @ApiOperation({ summary: 'List all posts for moderation' })
  async getPosts(
    @Query() pagination: PaginationDto,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    return this.adminService.getPosts(pagination, status, category);
  }

  @Put('posts/:id/status')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MODERATOR)
  @ApiOperation({ summary: 'Update post status' })
  async updatePostStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.adminService.updatePostStatus(id, body.status);
  }

  @Get('comments')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MODERATOR)
  @ApiOperation({ summary: 'List all comments for moderation' })
  async getComments(
    @Query() pagination: PaginationDto,
    @Query('status') status?: string,
    @Query('postId') postId?: string,
  ) {
    return this.adminService.getComments(pagination, status, postId);
  }

  @Put('comments/:id/status')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MODERATOR)
  @ApiOperation({ summary: 'Update comment status' })
  async updateCommentStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.adminService.updateCommentStatus(id, body.status);
  }

  // ─── Fact Checks ─────────────────────────────────────
  @Get('fact-checks')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MODERATOR)
  @ApiOperation({ summary: 'List fact checks' })
  async getFactChecks(
    @Query() pagination: PaginationDto,
  ) {
    return this.adminService.getFactChecks(pagination);
  }

  @Get('fact-checks/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MODERATOR)
  @ApiOperation({ summary: 'Get fact check by ID' })
  async getFactCheck(@Param('id') id: string) {
    return this.adminService.getFactCheck(id);
  }

  @Post('fact-checks')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MODERATOR)
  @ApiOperation({ summary: 'Create a fact check' })
  async createFactCheck(@Body() body: Record<string, unknown>) {
    return this.adminService.createFactCheck(body);
  }

  @Put('fact-checks/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MODERATOR)
  @ApiOperation({ summary: 'Update a fact check' })
  async updateFactCheck(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.updateFactCheck(id, body);
  }

  @Delete('fact-checks/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a fact check' })
  async deleteFactCheck(@Param('id') id: string) {
    return this.adminService.deleteFactCheck(id);
  }

  // ─── Feature Toggles ─────────────────────────────────
  @Get('features')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get feature toggles' })
  async getFeatureToggles() {
    return this.adminService.getFeatureToggles();
  }

  @Put('features/:feature')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Toggle a feature (super admin)' })
  async toggleFeature(
    @Param('feature') feature: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.adminService.toggleFeature(feature, body.enabled);
  }
}
