import { Module } from '@nestjs/common';
import { FactCheckController } from './fact-check.controller';
import { FactCheckService } from './fact-check.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FactCheckController],
  providers: [FactCheckService],
})
export class FactCheckModule {}
