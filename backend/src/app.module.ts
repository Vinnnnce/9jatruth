import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GeoModule } from './geo/geo.module';
import { PoliticsModule } from './politics/politics.module';
import { FeedModule } from './feed/feed.module';
import { PollsModule } from './polls/polls.module';
import { FactCheckModule } from './fact-check/fact-check.module';
import { NewsModule } from './news/news.module';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { UploadModule } from './upload/upload.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Structured logging
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
      },
    }),

    // Rate limiting
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: parseInt(process.env.THROTTLE_TTL || '60', 10) * 1000,
          limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
        },
      ],
    }),

    // Cache with Redis
    CacheModule.register({
      isGlobal: true,
      ttl: parseInt(process.env.CACHE_TTL || '300', 10) * 1000,
      max: 1000,
    }),

    // Scheduled tasks
    ScheduleModule.forRoot(),

    // Feature modules
    PrismaModule,
    AuthModule,
    UsersModule,
    GeoModule,
    PoliticsModule,
    FeedModule,
    PollsModule,
    FactCheckModule,
    NewsModule,
    AdminModule,
    AiModule,
    UploadModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
