import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

const RESPONSE_CACHE_TTL_KEY = 'response-cache-ttl';

@Injectable()
export class ResponseCacheService {
  constructor(private readonly cls: ClsService) {}

  trackTtl(ttl: number | null | undefined): void {
    if (!this.cls.isActive()) {
      return;
    }

    if (ttl === null || ttl === undefined) {
      return;
    }

    const normalizedTtl = Math.floor(ttl);

    if (normalizedTtl <= 0) {
      return;
    }

    const currentTtl = this.cls.get<number | undefined>(RESPONSE_CACHE_TTL_KEY);

    if (currentTtl === undefined || normalizedTtl < currentTtl) {
      this.cls.set(RESPONSE_CACHE_TTL_KEY, normalizedTtl);
    }
  }

  getTtl(): number | undefined {
    if (!this.cls.isActive()) {
      return undefined;
    }

    return this.cls.get<number | undefined>(RESPONSE_CACHE_TTL_KEY);
  }
}
