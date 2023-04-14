import { Module } from '@nestjs/common';
import { AuthService } from './auth-service';
import { BasicAuthStrategy } from './basic-auth.strategy';

@Module({
  imports: [],
  providers: [AuthService, BasicAuthStrategy],
})
export class AuthModule {}
