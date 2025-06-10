import { Module } from '@nestjs/common';
import { ProController } from '@/routes/pro/pro.controller';
import { ProService } from '@/routes/pro/pro.service';
import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';
import { BillingModule } from '@/routes/pro/billing/billing.module';
import { MembersModule } from '@/routes/spaces/members.module';

@Module({
  imports: [AuthRepositoryModule, BillingModule, MembersModule],
  controllers: [ProController],
  providers: [ProService],
})
export class ProModule {}
