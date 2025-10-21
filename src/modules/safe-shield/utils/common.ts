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
 * Creates a common FAILED analysis result grouped by status group.
 *
 * @param loggingService - The logging service for warning logs
 * @param statusGroup - The status group for the failure
 * @param type - The type of the analysis
 * @param reason - The error reason (optional)
 * @param description - The custom description (optional)
 * @returns A grouped FAILED analysis result
 */
export function createFailedAnalysisResult<
  T extends
    | RecipientAnalysisResult
    | ContractAnalysisResult
    | ThreatAnalysisResult,
>({
  loggingService,
  statusGroup,
  type,
  reason,
  description,
}: {
  loggingService: ILoggingService;
  statusGroup: StatusGroup;
  type: string;
  reason?: unknown;
  description?: string;
}): GroupedAnalysisResults<T> {
  let error: Error | undefined;
  if (reason) {
    error = asError(reason);
    loggingService.warn(`The analysis failed. ${error}`);
  }

  return {
    [statusGroup]: [
      {
        type: 'FAILED',
        severity: COMMON_SEVERITY_MAPPING.FAILED,
        title: `${type} analysis failed`,
        description:
          description ??
          COMMON_DESCRIPTION_MAPPING.FAILED({
            error: error?.message,
          }),
      },
    ],
  } as GroupedAnalysisResults<T>;
}
