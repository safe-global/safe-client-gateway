import type { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { LogType } from '@/domain/common/entities/log-type.entity';
import type { ILoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import {
  COMMON_DESCRIPTION_MAPPING,
  COMMON_SEVERITY_MAPPING,
} from '../entities/common-status.constants';
import type {
  RecipientAnalysisResult,
  ContractAnalysisResult,
  ThreatAnalysisResult,
} from '../entities/analysis-result.entity';
import type { GroupedAnalysisResults } from '../entities/analysis-responses.entity';
import type { StatusGroup } from '../entities/status-group.entity';

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

/**
 * Extracts a readable error message from a rejected promise.
 *
 * @param reason - The error reason from a rejected promise
 * @returns A string representation of the error
 */
export function extractReasonMessage(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }
  if (typeof reason === 'string') {
    return reason;
  }
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String(reason.message);
  }
  return String(reason);
}
