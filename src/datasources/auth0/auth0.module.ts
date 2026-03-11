import { Module } from '@nestjs/common';
import { JwtModule } from '@/datasources/jwt/jwt.module';
import { Auth0Service } from '@/datasources/auth0/auth0.service';
import { IAuth0Service } from '@/datasources/auth0/auth0.service.interface';

@Module({
  imports: [JwtModule],
  providers: [{ provide: IAuth0Service, useClass: Auth0Service }],
  exports: [IAuth0Service],
})
export class Auth0Module {}
