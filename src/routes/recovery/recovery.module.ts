import { Module } from '@nestjs/common';
import { RecoveryController } from '@/routes/recovery/recovery.controller';
import { RecoveryService } from '@/routes/recovery/recovery.service';
import { AlertsDomainModule } from '@/domain/alerts/alerts.domain.module';
import { SafeRepositoryModule } from '@/domain/safe/safe.repository.interface';

@Module({
  imports: [AlertsDomainModule, SafeRepositoryModule],
  controllers: [RecoveryController],
  providers: [RecoveryService],
})
export class RecoveryModule {}
