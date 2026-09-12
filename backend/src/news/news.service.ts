import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { QueryNewsDto } from './dto/query-news.dto';
import { NewsCategory, GeoScopeType } from '@prisma/client';
import {
  buildPaginationArgs,
  buildPaginationOrderBy,
  createPaginatedResult,
} from '../common/utils/pagination.util';

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async findNews(query: QueryNewsDto) {
    const where: Record<string, unknown> = {};

    if (query.category) where.category = query.category;
    if (query.geoScopeType) where.geoScopeType = query.geoScopeType;
    if (query.stateId) where.stateId = query.stateId;

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [articles, total] = await Promise.all([
      this.prisma.newsArticle.findMany({
        ...buildPaginationArgs(query),
        where,
        orderBy: buildPaginationOrderBy(query, 'publishedAt'),
      }),
      this.prisma.newsArticle.count({ where }),
    ]);

    return createPaginatedResult(articles, total, query);
  }

  @Cron(process.env.NEWS_FETCH_CRON || CronExpression.EVERY_2_HOURS)
  async fetchNewsFromApi(): Promise<void> {
    const apiKey = this.configService.get<string>('NEWS_API_KEY');
    if (!apiKey || apiKey === 'your-newsapi-key') {
      this.logger.warn('NEWS_API_KEY not configured, skipping news fetch');
      return;
    }

    const apiUrl = this.configService.get<string>('NEWS_API_URL') || 'https://newsapi.org/v2';
    const country = this.configService.get<string>('NEWS_API_COUNTRY') || 'ng';
    const categories = ['politics', 'business', 'technology'];

    this.logger.log(`Fetching news from NewsAPI...`);

    for (const category of categories) {
      try {
        const url = `${apiUrl}/top-headlines?country=${country}&category=${category}&apiKey=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json() as {
          articles?: Array<{
            source?: { name?: string };
            title?: string;
            description?: string;
            url?: string;
            urlToImage?: string;
            publishedAt?: string;
          }>;
        };

        if (!data.articles) continue;

        for (const article of data.articles) {
          if (!article.url) continue;

          // Skip if already exists
          const existing = await this.prisma.newsArticle.findUnique({
            where: { url: article.url },
          });
          if (existing) continue;

          await this.prisma.newsArticle.create({
            data: {
              source: article.source?.name || 'Unknown',
              title: article.title || 'Untitled',
              description: article.description,
              url: article.url,
              imageUrl: article.urlToImage,
              publishedAt: article.publishedAt ? new Date(article.publishedAt) : new Date(),
              geoScopeType: GeoScopeType.NATIONAL,
              category: this.mapCategory(category),
              tags: [category],
            },
          });
        }
      } catch (error) {
        this.logger.error(`Failed to fetch ${category} news: ${error}`);
      }
    }

    this.logger.log('News fetch completed');
  }

  private mapCategory(apiCategory: string): NewsCategory {
    const map: Record<string, NewsCategory> = {
      politics: NewsCategory.POLITICS,
      business: NewsCategory.ECONOMY,
      technology: NewsCategory.INFRASTRUCTURE,
    };
    return map[apiCategory] || NewsCategory.OTHER;
  }
}
