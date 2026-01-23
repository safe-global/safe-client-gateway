import { Module } from '@nestjs/common';
import { RecoveryController } from '@/modules/recovery/routes/recovery.controller';
import { RecoveryService } from '@/modules/recovery/routes/recovery.service';
import { AlertsModule } from '@/modules/alerts/alerts.module';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { AuthModule } from '@/modules/auth/auth.module';

@Module({
  imports: [AlertsModule, SafeRepositoryModule, AuthModule],
  controllers: [RecoveryController],
  providers: [RecoveryService],
})
export class RecoveryModule {}
