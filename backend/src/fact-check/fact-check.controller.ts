import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FactCheckService } from './fact-check.service';
import { CreateFactCheckDto } from './dto/create-fact-check.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Fact Check')
@Controller()
export class FactCheckController {
  constructor(private readonly factCheckService: FactCheckService) {}

  @Post('fact-check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.MODERATOR, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a fact check for a post (moderator+)' })
  async create(@Body() dto: CreateFactCheckDto) {
    return this.factCheckService.create(dto);
  }

  @Get('fact-check/:id')
  @ApiOperation({ summary: 'Get fact check by ID' })
  async findById(@Param('id') id: string) {
    return this.factCheckService.findById(id);
  }

  @Get('posts/:id/fact-check')
  @ApiOperation({ summary: 'Get fact checks and truth score for a post' })
  async findByPostId(@Param('id') postId: string) {
    return this.factCheckService.findByPostId(postId);
  }
}
