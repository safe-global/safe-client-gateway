import { registerAs } from '@nestjs/config';

export interface JwtConfiguration {
  issuer?: string;
  secret?: string;
}

export default registerAs(
  'jwt',
  (): JwtConfiguration => ({
    issuer: process.env.JWT_ISSUER,
    secret: process.env.JWT_SECRET,
  }),
);
