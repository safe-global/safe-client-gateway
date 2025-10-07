import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { ThreatAnalysisResponse } from '@/modules/safe-shield/entities/analysis-responses.entity';
import { ThreatAnalysisResult } from '@/modules/safe-shield/entities/analysis-result.entity';
import {
  Severity,
  compareSeverityString,
} from '@/modules/safe-shield/entities/severity.entity';
import { ThreatStatus } from '@/modules/safe-shield/entities/threat-status.entity';
import { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import { IBlockaidApi } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.interface';
import { BLOCKAID_SEVERITY_MAP } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid.constants';
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

  async analyze(args: {
    chainId: string;
    safeAddress: Address;
    transactions: Array<DecodedTransactionData>;
  }): Promise<Array<ThreatAnalysisResponse>> {
    const cacheDir = CacheRouter.getThreatAnalysisCacheDir({
      chainId: args.chainId,
    });

    const cached = await this.cacheService.hGet(cacheDir);

    if (cached) {
      logCacheHit(cacheDir, this.loggingService);
      try {
        return JSON.parse(cached) as Array<ThreatAnalysisResponse>;
      } catch (error) {
        this.loggingService.warn(
          `Failed to parse cached threat analysis results for ${JSON.stringify(cacheDir)}: ${error}`,
        );
      }
    }
    logCacheMiss(cacheDir, this.loggingService);

    //TODO deal with transactions

    const analysisResults: Array<ThreatAnalysisResponse> =
      await this.detectThreats(args);

    await this.cacheService.hSet(
      cacheDir,
      JSON.stringify(analysisResults),
      this.defaultExpirationTimeInSeconds,
    );
    return analysisResults;
  }

  async detectThreats(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<Array<ThreatAnalysisResult>> {
    const { chainId, safeAddress } = args;
    try {
      //TODO prepare message
      const response = await this.blockaidAPI.scanTransaction(
        chainId,
        safeAddress,
        '', //TODO to be replaced with real data
      );
      const { simulation, validation } = response;

      return [
        this.analyzeValidation(validation),
        ...this.analyzeSimulation(safeAddress, simulation),
      ];
    } catch (error) {
      this.loggingService.warn(
        `Error during threat analysis for Safe ${safeAddress} on chain ${chainId}: ${error}`,
      );

      return [this.mapToAnalysisResult({ type: 'FAILED' })];
    }
  }

  private analyzeValidation(
    validation?: TransactionValidation | TransactionValidationError,
  ): ThreatAnalysisResult {
    let type: ThreatStatus = 'FAILED';
    let issues: Map<keyof typeof Severity, Array<string>> | undefined;
    const { reason, classification, features, result_type } = validation ?? {};

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
        default:
          type = 'FAILED';
      }
      issues = this.groupIssuesBySeverity(features);
    }

    return this.mapToAnalysisResult({ type, reason, classification, issues });
  }

  private analyzeSimulation(
    safeAddress: Address,
    simulation?: TransactionSimulation | TransactionSimulationError,
  ): Array<ThreatAnalysisResult> {
    if (!simulation) return [];

    if (simulation.status === 'Error') {
      return [this.mapToAnalysisResult({ type: 'FAILED' })];
    }

    const items = simulation.contract_management?.[safeAddress] ?? [];

    return items.flatMap((m) => {
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
    });
  }

  /**
   * Groups validation issues by their severity.
   * @param features - List of features detected during threat analysis
   * @returns - Map of issues grouped by severity (highest to lowest)
   */
  private groupIssuesBySeverity(
    features?: Array<{ type: string; description: string }>,
  ): Map<keyof typeof Severity, Array<string>> {
    const issuesBySeverity = (features ?? []).reduce((acc, feature) => {
      // Only process Malicious and Warning types
      if (feature.type !== 'Malicious' && feature.type !== 'Warning') {
        return acc;
      }

      const severity = BLOCKAID_SEVERITY_MAP[feature.type];
      if (!acc.has(severity)) {
        acc.set(severity, []);
      }
      acc.get(severity)!.push(feature.description);
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
   * @returns The analysis result.
   */
  private mapToAnalysisResult(args: {
    type: ThreatStatus;
    reason?: string;
    classification?: string;
    issues?: Map<keyof typeof Severity, Array<string>>;
    before?: string;
    after?: string;
  }): ThreatAnalysisResult {
    const { type, reason, classification, issues, before, after } = args;
    const severity = SEVERITY_MAPPING[type];
    const title = TITLE_MAPPING[type];
    const description = DESCRIPTION_MAPPING[type]({ reason, classification });

    if (type === 'MASTER_COPY_CHANGE') {
      return {
        severity,
        type,
        title,
        description,
        before: before!,
        after: after!,
      };
    }

    if (type === 'MALICIOUS' || type === 'MODERATE') {
      return { severity, type, title, description, issues };
    }

    return { severity, type, title, description };
  }
}
