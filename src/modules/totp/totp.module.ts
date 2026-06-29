// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { UserTotp } from '@/modules/totp/datasources/entities/user-totp.entity.db';
import { TotpRepository } from '@/modules/totp/datasources/totp.repository';
import { TotpController } from '@/modules/totp/routes/totp.controller';
import { TotpService } from '@/modules/totp/routes/totp.service';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([UserTotp]),
    // Provides IAuthRepository (used by the service and the TotpGuard) and
    // makes AuthGuard usable on this module's controller.
    AuthModule,
  ],
  controllers: [TotpController],
  providers: [TotpService, TotpRepository],
})
export class TotpModule {}
