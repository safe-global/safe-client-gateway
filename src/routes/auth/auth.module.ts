import { Module } from '@nestjs/common';
import { AuthController } from '@/routes/auth/auth.controller';
import { AuthService } from '@/routes/auth/auth.service';
import { SiweRepositoryModule } from '@/domain/siwe/siwe.repository.interface';
import { JwtRepositoryModule } from '@/domain/jwt/jwt.repository.interface';

@Module({
  imports: [SiweRepositoryModule, JwtRepositoryModule],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
