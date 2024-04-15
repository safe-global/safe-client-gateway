import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  issuer: process.env.JWT_ISSUER,
  secret: process.env.JWT_SECRET,
}));
