import { Module } from '@nestjs/common';
import { AuthController } from '@/routes/auth/auth.controller';
import { AuthService } from '@/routes/auth/auth.service';
import { SiweRepositoryModule } from '@/domain/siwe/siwe.repository.interface';
import { AuthRepositoryModule } from '@/routes/auth/auth.repository.interface';

@Module({
  imports: [SiweRepositoryModule, AuthRepositoryModule],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
