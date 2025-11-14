import { Module } from '@nestjs/common';
import { RecoveryController } from '@/modules/recovery/routes/recovery.controller';
import { RecoveryService } from '@/modules/recovery/routes/recovery.service';
import { AlertsDomainModule } from '@/modules/alerts/domain/alerts.domain.module';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { AuthRepositoryModule } from '@/modules/auth/domain/auth.repository.interface';

@Module({
  imports: [AlertsDomainModule, SafeRepositoryModule, AuthRepositoryModule],
  controllers: [RecoveryController],
  providers: [RecoveryService],
})
export class RecoveryModule {}
