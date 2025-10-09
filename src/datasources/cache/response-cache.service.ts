import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

const RESPONSE_CACHE_TTL_KEY = 'response-cache-ttl';
const RESPONSE_CACHE_TTL_CACHE_KEY = 'response-cache-ttl-cache';
const RESPONSE_CACHE_TTL_FAILED_KEY = 'response-cache-ttl-failed';

@Injectable()
export class ResponseCacheService {
  constructor(private readonly cls: ClsService) {}

  markTtlTrackingFailed(): void {
    if (!this.cls.isActive()) {
      return;
    }
    this.cls.set(RESPONSE_CACHE_TTL_FAILED_KEY, true);
  }

  hasTtlTrackingFailed(): boolean {
    if (!this.cls.isActive()) {
      return false;
    }
    return this.cls.get<boolean>(RESPONSE_CACHE_TTL_FAILED_KEY) ?? false;
  }

  trackTtl(ttl: number | null | undefined, cacheKey: string): void {
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

    // Cache TTL values to avoid redundant Redis calls
    const ttlCache =
      this.cls.get<Record<string, number>>(RESPONSE_CACHE_TTL_CACHE_KEY) ?? {};

    if (ttlCache[cacheKey] !== undefined) {
      return; // Already tracked this cache key in this request
    }

    ttlCache[cacheKey] = normalizedTtl;
    this.cls.set(RESPONSE_CACHE_TTL_CACHE_KEY, ttlCache);

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
