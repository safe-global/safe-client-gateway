import type { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { LogType } from '@/domain/common/entities/log-type.entity';
import type { ILoggingService } from '@/logging/logging.interface';

export function logCacheHit(
  cacheDir: CacheDir,
  loggingService: ILoggingService,
): void {
  loggingService.debug({
    type: LogType.CacheHit,
    key: cacheDir.key,
    field: cacheDir.field,
  });
}

export function logCacheMiss(
  cacheDir: CacheDir,
  loggingService: ILoggingService,
): void {
  loggingService.debug({
    type: LogType.CacheMiss,
    key: cacheDir.key,
    field: cacheDir.field,
  });
}
