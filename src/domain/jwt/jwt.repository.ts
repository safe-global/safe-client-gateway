import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { IJwtRepository } from '@/domain/jwt/jwt.repository.interface';

@Injectable()
export class JwtRepository implements IJwtRepository {
  constructor(
    @Inject(IJwtService)
    private readonly jwtService: IJwtService,
  ) {}

  signToken<T extends string | object>(
    payload: T,
    options?: {
      expiresIn?: number;
      notBefore?: number;
    },
  ): string {
    return this.jwtService.sign(payload, options);
  }

  verifyToken<T extends z.ZodTypeAny>(
    accessToken: string,
    schema: T,
  ): z.ZodType<z.infer<T>> {
    const payload = this.jwtService.verify(accessToken);
    return schema.parse(payload);
  }
}
