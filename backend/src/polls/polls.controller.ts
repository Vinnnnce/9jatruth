import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PollsService } from './polls.service';
import { CreatePollDto } from './dto/create-poll.dto';
import { VotePollDto } from './dto/vote-poll.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { QueryFeedDto } from '../feed/dto/query-feed.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Polls')
@Controller('polls')
export class PollsController {
  constructor(private readonly pollsService: PollsService) {}

  @Get()
  @ApiOperation({ summary: 'List polls with geo filters' })
  async findPolls(
    @Query() pagination: PaginationDto,
    @Query() query: QueryFeedDto,
  ) {
    return this.pollsService.findPolls(pagination, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get poll by ID with vote counts' })
  async findPoll(@Param('id') id: string) {
    return this.pollsService.findPollById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.MODERATOR, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a poll (moderator+)' })
  async createPoll(@Body() dto: CreatePollDto) {
    return this.pollsService.createPoll(dto);
  }

  @Post(':id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Vote in a poll' })
  async vote(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VotePollDto,
  ) {
    return this.pollsService.vote(id, user.id, dto);
  }
}
