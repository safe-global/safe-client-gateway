import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { ThreatAnalysisRequest } from '@/modules/safe-shield/entities/analysis-requests.entity';
import { ThreatAnalysisResponse } from '@/modules/safe-shield/entities/analysis-responses.entity';
import {
  CommonStatus,
  ThreatAnalysisResult,
} from '@/modules/safe-shield/entities/analysis-result.entity';
import {
  Severity,
  compareSeverityString,
} from '@/modules/safe-shield/entities/severity.entity';
import {
  BalanceChanges,
  BalanceChangesSchema,
} from '@/modules/safe-shield/entities/threat-analysis.types';
import { ThreatStatus } from '@/modules/safe-shield/entities/threat-status.entity';
import { IBlockaidApi } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.interface';
import {
  BLOCKAID_SEVERITY_MAP,
  CLASSIFICATION_MAPPING,
  REASON_MAPPING,
} from '@/modules/safe-shield/threat-analysis/blockaid/blockaid.constants';
import {
  DESCRIPTION_MAPPING,
  SEVERITY_MAPPING,
  TITLE_MAPPING,
} from '@/modules/safe-shield/threat-analysis/threat-analysis.constants';
import { logCacheHit, logCacheMiss } from '@/modules/safe-shield/utils/common';
import {
  TransactionSimulation,
  TransactionSimulationError,
  TransactionValidation,
  TransactionValidationError,
} from '@blockaid/client/resources/index';
import { Inject, Injectable } from '@nestjs/common';
import { Address } from 'viem';
import { TypedData } from '@/domain/messages/entities/typed-data.entity';

/**
 * Service responsible for analyzing transactions for security threats and malicious patterns.
 */
@Injectable()
export class ThreatAnalysisService {
  private readonly defaultExpirationTimeInSeconds: number;

  constructor(
    @Inject(IBlockaidApi)
    private readonly blockaidAPI: IBlockaidApi,
    @Inject(CacheService)
    private readonly cacheService: ICacheService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.default',
      );
  }

  async analyze({
    chainId,
    safeAddress,
    request,
  }: {
    chainId: string;
    safeAddress: Address;
    request: ThreatAnalysisRequest;
  }): Promise<ThreatAnalysisResponse> {
    const { walletAddress, origin, data } = request;
    const message = this.serializeMessage(data);
    if (!message) {
      return this.getFailedAnalysisResponse();
    }

    const cacheDir = CacheRouter.getThreatAnalysisCacheDir({
      chainId,
      safeAddress,
      walletAddress,
      message,
      origin,
    });
    const cached = await this.cacheService.hGet(cacheDir);

    if (cached) {
      logCacheHit(cacheDir, this.loggingService);
      try {
        return JSON.parse(cached) as ThreatAnalysisResponse;
      } catch (error) {
        this.loggingService.warn(
          `Failed to parse cached threat analysis results: ${error}`,
        );
      }
    }
    logCacheMiss(cacheDir, this.loggingService);

    const analysisResults = await this.detectThreats(
      chainId,
      safeAddress,
      walletAddress,
      message,
      origin,
    );

    await this.cacheService.hSet(
      cacheDir,
      JSON.stringify(analysisResults),
      this.defaultExpirationTimeInSeconds,
    );
    return analysisResults;
  }

  private serializeMessage(data: TypedData): string | null {
    try {
      return JSON.stringify(data);
    } catch (error) {
      this.loggingService.warn(
        `Failed to serialize threat analysis request data: ${error}`,
      );
      return null;
    }
  }

  private async detectThreats(
    chainId: string,
    safeAddress: Address,
    walletAddress: Address,
    message: string,
    origin?: string,
  ): Promise<ThreatAnalysisResponse> {
    try {
      const response = await this.blockaidAPI.scanTransaction(
        chainId,
        safeAddress,
        walletAddress,
        message,
        origin,
      );
      const { simulation, validation } = response;

      return this.processAnalysisResults(safeAddress, simulation, validation);
    } catch (error) {
      this.loggingService.warn(
        `Error during threat analysis for Safe ${safeAddress} on chain ${chainId}: ${error}`,
      );
      return this.getFailedAnalysisResponse();
    }
  }

  private processAnalysisResults(
    safeAddress: Address,
    simulation?: TransactionSimulation | TransactionSimulationError,
    validation?: TransactionValidation | TransactionValidationError,
  ): ThreatAnalysisResponse {
    const { results, balanceChanges } = this.analyzeSimulation(
      safeAddress,
      simulation,
    );
    const validationResult = this.analyzeValidation(validation);

    const threatResults = [validationResult, ...results].sort((a, b) =>
      compareSeverityString(b.severity, a.severity),
    );

    return {
      THREAT: threatResults,
      BALANCE_CHANGE: balanceChanges,
    };
  }

  private analyzeValidation(
    validation?: TransactionValidation | TransactionValidationError,
  ): ThreatAnalysisResult {
    let type: ThreatStatus | CommonStatus = 'FAILED';
    let issues: Map<keyof typeof Severity, Array<string>> | undefined;
    const {
      reason,
      classification,
      features = [],
      result_type,
    } = validation ?? {};

    if (validation) {
      switch (result_type) {
        case 'Benign':
          type = 'NO_THREAT';
          break;
        case 'Warning':
          type = 'MODERATE';
          break;
        case 'Malicious':
          type = 'MALICIOUS';
          break;
      }
      issues = this.groupIssuesBySeverity(features);
    }

    return this.mapToAnalysisResult({
      type,
      reason,
      classification,
      issues,
    });
  }

  private analyzeSimulation(
    safeAddress: Address,
    simulation?: TransactionSimulation | TransactionSimulationError,
  ): {
    results: Array<ThreatAnalysisResult>;
    balanceChanges: BalanceChanges;
  } {
    let results: Array<ThreatAnalysisResult> = [];
    let balanceChanges: BalanceChanges = [];

    if (!simulation) {
      return { results, balanceChanges };
    }

    if (simulation.status === 'Error') {
      results = [
        this.mapToAnalysisResult({
          type: 'FAILED',
          error: simulation.description,
        }),
      ];
      return { results, balanceChanges };
    }

    balanceChanges = BalanceChangesSchema.parse(
      simulation.assets_diffs?.[safeAddress] ?? [],
    );

    results = (simulation.contract_management?.[safeAddress] ?? []).flatMap(
      (m) => {
        switch (m.type) {
          case 'PROXY_UPGRADE':
            return [
              this.mapToAnalysisResult({
                type: 'MASTER_COPY_CHANGE',
                before: m.before.address,
                after: m.after.address,
              }),
            ];
          case 'OWNERSHIP_CHANGE':
            return [this.mapToAnalysisResult({ type: 'OWNERSHIP_CHANGE' })];
          case 'MODULE_CHANGE':
            return [this.mapToAnalysisResult({ type: 'MODULE_CHANGE' })];
          default:
            return [];
        }
      },
    );

    return { results, balanceChanges };
  }

  /**
   * Groups validation issues by their severity.
   * @param features - List of features detected during threat analysis
   * @returns - Map of issues grouped by severity (highest to lowest)
   */
  private groupIssuesBySeverity(
    features: Array<{ type: string; description: string }>,
  ): Map<keyof typeof Severity, Array<string>> {
    if (!features.length) {
      return new Map();
    }
    const issuesBySeverity = features.reduce((acc, feature) => {
      if (feature.type !== 'Malicious' && feature.type !== 'Warning') {
        return acc;
      }

      const severity = BLOCKAID_SEVERITY_MAP[feature.type];
      if (!acc.has(severity)) {
        acc.set(severity, [feature.description]);
      } else {
        acc.get(severity)!.push(feature.description);
      }
      return acc;
    }, new Map<keyof typeof Severity, Array<string>>());

    return new Map(
      [...issuesBySeverity.entries()].sort((a, b) =>
        compareSeverityString(b[0], a[0]),
      ),
    );
  }

  /**
   * Maps a threat analysis status to an analysis result.
   * @param type - The threat status.
   * @param reason - A description about the reasons the transaction was flagged with the type.
   * @param classification - A classification explaining the reason of threat analysis result.
   * @param issues - A potential map of specific issues identified during threat analysis, grouped by severity.
   * @param before - The old master copy address (only for MASTER_COPY_CHANGE).
   * @param after - The new master copy address (only for MASTER_COPY_CHANGE).
   * @param error - An error message in case of a failure (optional).
   * @returns The analysis result.
   */
  private mapToAnalysisResult(args: {
    type: ThreatStatus | CommonStatus;
    reason?: string;
    classification?: string;
    issues?: Map<keyof typeof Severity, Array<string>>;
    before?: string;
    after?: string;
    error?: string;
  }): ThreatAnalysisResult {
    const { type, reason, classification, issues, before, after, error } = args;
    const severity = SEVERITY_MAPPING[type];
    const title = TITLE_MAPPING[type];
    const reasonMsg = reason ? REASON_MAPPING[reason] : '';
    const classificationMsg = classification
      ? CLASSIFICATION_MAPPING[classification]
      : '';
    const description = DESCRIPTION_MAPPING[type]({
      reason: reasonMsg,
      classification: classificationMsg,
      error,
    });

    switch (type) {
      case 'MASTER_COPY_CHANGE':
        return {
          severity,
          type,
          title,
          description,
          before: before ?? '',
          after: after ?? '',
        };
      case 'MALICIOUS':
      case 'MODERATE':
        return { severity, type, title, description, issues };
      default:
        return { severity, type, title, description };
    }
  }

  private getFailedAnalysisResponse(): ThreatAnalysisResponse {
    return {
      THREAT: [this.mapToAnalysisResult({ type: 'FAILED' })],
      BALANCE_CHANGE: [],
    };
  }
}
