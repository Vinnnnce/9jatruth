import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NewsService } from './news.service';
import { QueryNewsDto } from './dto/query-news.dto';

@ApiTags('News')
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  @ApiOperation({ summary: 'List news articles with filters and pagination' })
  async findNews(@Query() query: QueryNewsDto) {
    return this.newsService.findNews(query);
  }
}
