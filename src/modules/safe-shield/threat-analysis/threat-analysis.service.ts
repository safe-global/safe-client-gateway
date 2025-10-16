import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { ThreatAnalysisRequestBody } from '@/modules/safe-shield/entities/analysis-requests.entity';
import { ThreatAnalysisResponse } from '@/modules/safe-shield/entities/analysis-responses.entity';
import { ThreatAnalysisResult } from '@/modules/safe-shield/entities/analysis-result.entity';
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
import { BLOCKAID_SEVERITY_MAP } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid.constants';
import {
  DESCRIPTION_MAPPING,
  SAFE_VERSION,
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
import { generateTypedData } from '@safe-global/protocol-kit';
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
    requestData: ThreatAnalysisRequestBody;
  }): Promise<ThreatAnalysisResponse> {
    const cacheDir = CacheRouter.getThreatAnalysisCacheDir({
      chainId: args.chainId,
      requestData: args.requestData,
    });
    const cached = await this.cacheService.hGet(cacheDir);

    if (cached) {
      logCacheHit(cacheDir, this.loggingService);
      try {
        return JSON.parse(cached) as ThreatAnalysisResponse;
      } catch (error) {
        this.loggingService.warn(
          `Failed to parse cached threat analysis results for ${JSON.stringify(cacheDir)}: ${error}`,
        );
      }
    }
    logCacheMiss(cacheDir, this.loggingService);

    const analysisResults: ThreatAnalysisResponse =
      await this.detectThreats(args);

    await this.cacheService.hSet(
      cacheDir,
      JSON.stringify(analysisResults),
      this.defaultExpirationTimeInSeconds,
    );
    return analysisResults;
  }

  private async detectThreats(args: {
    chainId: string;
    safeAddress: Address;
    requestData: ThreatAnalysisRequestBody;
  }): Promise<ThreatAnalysisResponse> {
    const { chainId, safeAddress, requestData } = args;
    const { walletAddress, ...data } = requestData;
    try {
      const message = this.prepareMessage({
        chainId,
        safeAddress,
        data,
      });
      const response = await this.blockaidAPI.scanTransaction(
        chainId,
        safeAddress,
        walletAddress,
        message,
      );
      const { simulation, validation } = response;

      return this.processAnalysisResults(safeAddress, simulation, validation);
    } catch (error) {
      this.loggingService.warn(
        `Error during threat analysis for Safe ${safeAddress} on chain ${chainId}: ${error}`,
      );

      return {
        THREAT: [this.mapToAnalysisResult({ type: 'FAILED' })],
        BALANCE_CHANGE: [],
      };
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
    let type: ThreatStatus = 'FAILED';
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
        default:
          type = 'FAILED';
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
          reason: simulation.description,
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

  /**
   * Prepares the message for threat analysis by generating EIP-712 typed data.
   * @param args - The arguments containing chainId, safeAddress, and requestData.
   * @returns - The message as a JSON string.
   */
  private prepareMessage(args: {
    chainId: string;
    safeAddress: Address;
    data: Omit<ThreatAnalysisRequestBody, 'walletAddress'>;
  }): string {
    const { chainId, safeAddress, data } = args;
    /* TODO it seems we never provide EIP-712 typed data */
    // if (isEIP712TypedData(data)) {
    //   const normalizedMsg = normalizeTypedData(data);
    //   return JSON.stringify(normalizedMsg);
    // } else {

    return JSON.stringify(
      generateTypedData({
        safeAddress,
        safeVersion: SAFE_VERSION,
        chainId: BigInt(chainId),
        data: {
          ...data,
          nonce: Number(data.nonce),
        },
      }),
    );
    // }
  }
}
