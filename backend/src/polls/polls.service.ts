import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePollDto } from './dto/create-poll.dto';
import { VotePollDto } from './dto/vote-poll.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { QueryFeedDto } from '../feed/dto/query-feed.dto';
import {
  buildPaginationArgs,
  buildPaginationOrderBy,
  createPaginatedResult,
} from '../common/utils/pagination.util';

@Injectable()
export class PollsService {
  constructor(private prisma: PrismaService) {}

  async createPoll(dto: CreatePollDto) {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    if (endAt <= startAt) {
      throw new BadRequestException('End date must be after start date');
    }

    // Store options as array of {id, text, votes: 0}
    const options = dto.options.map((text, index) => ({
      id: `opt_${index}`,
      text,
      votes: 0,
    }));

    return this.prisma.poll.create({
      data: {
        question: dto.question,
        options,
        geoScopeType: dto.geoScopeType || 'NATIONAL',
        stateId: dto.stateId,
        lgaId: dto.lgaId,
        wardId: dto.wardId,
        communityId: dto.communityId,
        startAt,
        endAt,
      },
    });
  }

  async findPolls(pagination: PaginationDto, query?: QueryFeedDto) {
    const where: Record<string, unknown> = {};

    if (query?.geoScopeType) where.geoScopeType = query.geoScopeType;
    if (query?.stateId) where.stateId = query.stateId;
    if (query?.lgaId) where.lgaId = query.lgaId;
    if (query?.wardId) where.wardId = query.wardId;
    if (query?.communityId) where.communityId = query.communityId;

    const [polls, total] = await Promise.all([
      this.prisma.poll.findMany({
        ...buildPaginationArgs(pagination),
        where,
        orderBy: buildPaginationOrderBy(pagination, 'createdAt'),
        include: {
          _count: { select: { votes: true } },
        },
      }),
      this.prisma.poll.count({ where }),
    ]);

    return createPaginatedResult(polls, total, pagination);
  }

  async findPollById(id: string) {
    const poll = await this.prisma.poll.findUnique({
      where: { id },
      include: {
        votes: {
          include: {
            user: {
              select: { id: true, name: true, username: true },
            },
          },
        },
      },
    });

    if (!poll) throw new NotFoundException('Poll not found');

    // Calculate vote counts per option
    const options = (poll.options as unknown as Array<{ id: string; text: string; votes: number }>).map(
      (opt) => {
        const voteCount = poll.votes.filter((v) => v.optionId === opt.id).length;
        return { ...opt, votes: voteCount };
      },
    );

    return {
      ...poll,
      options,
      totalVotes: poll.votes.length,
    };
  }

  async vote(pollId: string, userId: string, dto: VotePollDto) {
    const poll = await this.prisma.poll.findUnique({ where: { id: pollId } });
    if (!poll) throw new NotFoundException('Poll not found');

    const now = new Date();
    if (now < poll.startAt) {
      throw new BadRequestException('Poll has not started yet');
    }
    if (now > poll.endAt) {
      throw new BadRequestException('Poll has ended');
    }

    // Validate option exists
    const options = poll.options as unknown as Array<{ id: string; text: string }>;
    const optionExists = options.some((opt) => opt.id === dto.optionId);
    if (!optionExists) {
      throw new BadRequestException('Invalid option');
    }

    // Check if user already voted
    const existing = await this.prisma.pollVote.findUnique({
      where: { pollId_userId: { pollId, userId } },
    });

    if (existing) {
      throw new ConflictException('You have already voted in this poll');
    }

    return this.prisma.pollVote.create({
      data: {
        pollId,
        userId,
        optionId: dto.optionId,
      },
    });
  }
}
