import { AuthApiModule } from '@/datasources/auth-api/auth-api.module';
import { AuthRepository } from '@/domain/auth/auth.repository';
import { IAuthRepository } from '@/domain/auth/auth.repository.interface';
import { Module } from '@nestjs/common';

@Module({
  imports: [AuthApiModule],
  providers: [{ provide: IAuthRepository, useClass: AuthRepository }],
  exports: [IAuthRepository],
})
export class AuthDomainModule {}
