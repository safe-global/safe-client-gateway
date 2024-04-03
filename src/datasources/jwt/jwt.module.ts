import * as jwt from 'jsonwebtoken';
import { Global, Module } from '@nestjs/common';
import { JwtService } from '@/datasources/jwt/jwt.service';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';

// Use inferred type
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function jwtClientFactory() {
  return {
    sign: jwt.sign,
    verify: jwt.verify,
  };
}

export type JwtClient = ReturnType<typeof jwtClientFactory>;

@Global()
@Module({
  providers: [
    {
      provide: 'JwtClient',
      useFactory: jwtClientFactory,
    },
    { provide: IJwtService, useClass: JwtService },
  ],
  exports: [IJwtService],
})
export class JwtModule {}
