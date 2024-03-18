import { IConfigurationService } from '@/config/configuration.service.interface';
import { JwtService } from '@/datasources/jwt/jwt.service';
import { IJwtService } from '@/domain/interfaces/jwt-api.interface';
import { Global, Module } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

// Use inferred type
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function jwtClientFactory(configurationService: IConfigurationService) {
  const secret = configurationService.getOrThrow<string>('jwt.secret');

  return {
    sign: (
      payload: string | Buffer | object,
      options?: jwt.SignOptions,
    ): string => {
      return jwt.sign(payload, secret, options);
    },
    verify: <T>(
      token: string,
      options?: Omit<jwt.VerifyOptions, 'complete'>,
    ): T => {
      // As we are not `complete` decoding, it will be T if verified
      return jwt.verify(token, secret, options) as T;
    },
  };
}

export type JwtClient = ReturnType<typeof jwtClientFactory>;

@Global()
@Module({
  providers: [
    {
      provide: 'JwtClient',
      useFactory: jwtClientFactory,
      inject: [IConfigurationService],
    },
    { provide: IJwtService, useClass: JwtService },
  ],
  exports: [IJwtService],
})
export class JwtModule {}
