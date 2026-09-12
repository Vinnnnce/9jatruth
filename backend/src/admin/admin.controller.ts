import { Controller, Get, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
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

  @Get('stats')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get platform statistics' })
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('reports')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List reports' })
  async getReports(
    @Query() pagination: PaginationDto,
    @Query('status') status?: ReportStatus,
  ) {
    return this.adminService.getReports(pagination, status);
  }

  @Put('reports/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Resolve a report' })
  async resolveReport(
    @Param('id') id: string,
    @Body() body: { status: ReportStatus },
  ) {
    return this.adminService.resolveReport(id, body.status);
  }

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
