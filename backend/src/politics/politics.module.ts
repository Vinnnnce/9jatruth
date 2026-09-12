import { Module } from '@nestjs/common';
import { PoliticsController } from './politics.controller';
import { PoliticsService } from './politics.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PoliticsController],
  providers: [PoliticsService],
})
export class PoliticsModule {}
