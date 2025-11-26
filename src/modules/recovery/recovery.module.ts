import { Module } from '@nestjs/common';
import { RecoveryController } from '@/modules/recovery/routes/recovery.controller';
import { RecoveryService } from '@/modules/recovery/routes/recovery.service';
import { AlertsDomainModule } from '@/modules/alerts/domain/alerts.domain.module';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { AuthModule } from '@/modules/auth/auth.module';

@Module({
  imports: [AlertsDomainModule, SafeRepositoryModule, AuthModule],
  controllers: [RecoveryController],
  providers: [RecoveryService],
})
export class RecoveryModule {}
