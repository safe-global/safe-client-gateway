import { Module } from '@nestjs/common';
import { AuthService } from '../common/auth/auth-service';
import { AuthModule } from '../common/auth/auth.module';
import { FlushController } from './flush.controller';
import { FlushService } from './flush.service';

@Module({
  controllers: [FlushController],
  imports: [AuthModule],
  providers: [FlushService, AuthService],
})
export class FlushModule {}
