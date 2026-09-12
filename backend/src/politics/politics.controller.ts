import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PoliticsService } from './politics.service';
import { CreatePartyDto } from './dto/create-party.dto';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { CreateOfficeDto } from './dto/create-office.dto';
import { CreateElectionDto } from './dto/create-election.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Politics')
@Controller()
export class PoliticsController {
  constructor(private readonly politicsService: PoliticsService) {}

  // ─── Parties ──────────────────────────────────────────
  @Get('parties')
  @ApiOperation({ summary: 'List political parties' })
  async findParties(@Query() pagination: PaginationDto) {
    return this.politicsService.findParties(pagination);
  }

  @Get('parties/:id')
  @ApiOperation({ summary: 'Get party by ID' })
  async findParty(@Param('id') id: string) {
    return this.politicsService.findPartyById(id);
  }

  @Post('parties')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a party (admin)' })
  async createParty(@Body() dto: CreatePartyDto) {
    return this.politicsService.createParty(dto);
  }

  @Put('parties/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a party (admin)' })
  async updateParty(@Param('id') id: string, @Body() dto: Partial<CreatePartyDto>) {
    return this.politicsService.updateParty(id, dto);
  }

  @Delete('parties/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a party (super admin)' })
  async deleteParty(@Param('id') id: string) {
    return this.politicsService.deleteParty(id);
  }

  // ─── Candidates ───────────────────────────────────────
  @Get('candidates')
  @ApiOperation({ summary: 'List candidates' })
  async findCandidates(@Query() pagination: PaginationDto) {
    return this.politicsService.findCandidates(pagination);
  }

  @Get('candidates/:id')
  @ApiOperation({ summary: 'Get candidate by ID' })
  async findCandidate(@Param('id') id: string) {
    return this.politicsService.findCandidateById(id);
  }

  @Post('candidates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a candidate (admin)' })
  async createCandidate(@Body() dto: CreateCandidateDto) {
    return this.politicsService.createCandidate(dto);
  }

  @Put('candidates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a candidate (admin)' })
  async updateCandidate(@Param('id') id: string, @Body() dto: Partial<CreateCandidateDto>) {
    return this.politicsService.updateCandidate(id, dto);
  }

  @Delete('candidates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a candidate (super admin)' })
  async deleteCandidate(@Param('id') id: string) {
    return this.politicsService.deleteCandidate(id);
  }

  // ─── Offices ──────────────────────────────────────────
  @Get('offices')
  @ApiOperation({ summary: 'List political offices' })
  async findOffices() {
    return this.politicsService.findOffices();
  }

  @Post('offices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create an office (admin)' })
  async createOffice(@Body() dto: CreateOfficeDto) {
    return this.politicsService.createOffice(dto);
  }

  @Put('offices/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an office (admin)' })
  async updateOffice(@Param('id') id: string, @Body() dto: Partial<CreateOfficeDto>) {
    return this.politicsService.updateOffice(id, dto);
  }

  @Delete('offices/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete an office (super admin)' })
  async deleteOffice(@Param('id') id: string) {
    return this.politicsService.deleteOffice(id);
  }

  // ─── Elections ────────────────────────────────────────
  @Get('elections')
  @ApiOperation({ summary: 'List elections' })
  async findElections(@Query() pagination: PaginationDto) {
    return this.politicsService.findElections(pagination);
  }

  @Get('elections/:id')
  @ApiOperation({ summary: 'Get election by ID' })
  async findElection(@Param('id') id: string) {
    return this.politicsService.findElectionById(id);
  }

  @Post('elections')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create an election (admin)' })
  async createElection(@Body() dto: CreateElectionDto) {
    return this.politicsService.createElection(dto);
  }

  @Put('elections/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an election (admin)' })
  async updateElection(@Param('id') id: string, @Body() dto: Partial<CreateElectionDto>) {
    return this.politicsService.updateElection(id, dto);
  }

  @Delete('elections/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete an election (super admin)' })
  async deleteElection(@Param('id') id: string) {
    return this.politicsService.deleteElection(id);
  }
}
