import { Module } from '@nestjs/common';
import { AlertsModule } from '@/modules/alerts/alerts.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { RecoveryController } from '@/modules/recovery/routes/recovery.controller';
import { RecoveryService } from '@/modules/recovery/routes/recovery.service';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';

@Module({
  imports: [AlertsModule, SafeRepositoryModule, AuthModule],
  controllers: [RecoveryController],
  providers: [RecoveryService],
})
export class RecoveryModule {}
