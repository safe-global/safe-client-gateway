import { Module } from '@nestjs/common';
import { AuthController } from '@/routes/auth/auth.controller';
import { AuthService } from '@/routes/auth/auth.service';
import { AuthDomainModule } from '@/domain/auth/auth.domain.module';
import { JwtModule } from '@/datasources/jwt/jwt.module';

@Module({
  imports: [AuthDomainModule, JwtModule],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
