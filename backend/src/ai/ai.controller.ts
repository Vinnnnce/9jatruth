import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('AI')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('ask')
  @ApiOperation({ summary: 'Ask the AI assistant a question (scaffolded)' })
  async ask(@Body() body: { question: string; context?: string }) {
    return this.aiService.ask(body);
  }

  @Post('summarize')
  @ApiOperation({ summary: 'Summarize text (scaffolded)' })
  async summarize(@Body() body: { text: string }) {
    const summary = await this.aiService.summarize(body.text);
    return { summary };
  }
}
