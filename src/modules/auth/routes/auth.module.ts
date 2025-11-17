import { Module } from '@nestjs/common';
import { AuthController } from '@/modules/auth/routes/auth.controller';
import { AuthService } from '@/modules/auth/routes/auth.service';
import { SiweRepositoryModule } from '@/modules/siwe/domain/siwe.repository.interface';
import { AuthRepositoryModule } from '@/modules/auth/domain/auth.repository.interface';

@Module({
  imports: [SiweRepositoryModule, AuthRepositoryModule],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
