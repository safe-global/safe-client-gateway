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
  BalanceChange,
  BalanceChangesSchema,
} from '@/modules/safe-shield/entities/threat-analysis.types';
import { ThreatStatus } from '@/modules/safe-shield/entities/threat-status.entity';
import { IBlockaidApi } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.interface';
import {
  BLOCKAID_SEVERITY_MAP,
  prepareDescription,
} from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.constants';
import {
  DESCRIPTION_MAPPING,
  SEVERITY_MAPPING,
  TITLE_MAPPING,
} from '@/modules/safe-shield/threat-analysis/threat-analysis.constants';
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
 * @class ThreatAnalysisService
 */
@Injectable()
export class ThreatAnalysisService {
  constructor(
    @Inject(IBlockaidApi)
    private readonly blockaidAPI: IBlockaidApi,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  /**
   * Analyzes a transaction request for security threats.
   * @param {Object} params - The analysis parameters
   * @param {string} params.chainId - The blockchain chain ID
   * @param {Address} params.safeAddress - The Safe wallet address
   * @param {ThreatAnalysisRequest} params.request - The threat analysis request
   * @returns {Promise<ThreatAnalysisResponse>} The threat analysis response
   */
  public async analyze({
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
      return this.failedAnalysisResponse();
    }

    return await this.detectThreats(
      chainId,
      safeAddress,
      walletAddress,
      message,
      origin,
    );
  }

  /**
   * Serializes typed data to a JSON string.
   * @param {TypedData} data - The typed data to serialize
   * @returns {string | null} The serialized message or null if serialization fails
   */
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

  /**
   * Detects threats in a transaction by scanning with Blockaid API.
   * @param {string} chainId - The blockchain chain ID
   * @param {Address} safeAddress - The Safe wallet address
   * @param {Address} walletAddress - The wallet address initiating the transaction
   * @param {string} message - The serialized transaction message
   * @param {string} [origin] - Optional origin URL
   * @returns {Promise<ThreatAnalysisResponse>} The threat analysis response
   */
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
      return this.failedAnalysisResponse();
    }
  }

  /**
   * Processes simulation and validation results into a threat analysis response.
   * @param {Address} safeAddress - The Safe wallet address
   * @param {TransactionSimulation | TransactionSimulationError} [simulation] - The transaction simulation result
   * @param {TransactionValidation | TransactionValidationError} [validation] - The transaction validation result
   * @returns {ThreatAnalysisResponse} The processed threat analysis response
   */
  private processAnalysisResults(
    safeAddress: Address,
    simulation?: TransactionSimulation | TransactionSimulationError,
    validation?: TransactionValidation | TransactionValidationError,
  ): ThreatAnalysisResponse {
    const [results, balanceChanges] = this.analyzeSimulation(
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

  /**
   * Analyzes transaction validation results and maps them to a threat analysis result.
   * @param {TransactionValidation | TransactionValidationError} [validation] - The transaction validation result
   * @returns {ThreatAnalysisResult} The analyzed threat result
   */
  private analyzeValidation(
    validation?: TransactionValidation | TransactionValidationError,
  ): ThreatAnalysisResult {
    let type: ThreatStatus | CommonStatus = 'FAILED';

    if (!validation || validation.result_type === 'Error') {
      return this.mapToAnalysisResult({
        type,
        error: validation?.error,
      });
    }

    const {
      reason,
      classification,
      description,
      features = [],
      result_type,
    } = validation;
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

    const issues = this.groupIssuesBySeverity(features);

    return this.mapToAnalysisResult({
      type,
      reason,
      classification,
      description,
      issues,
    });
  }

  /**
   * Analyzes transaction simulation results to extract threats and balance changes.
   * @param {Address} safeAddress - The Safe wallet address
   * @param {TransactionSimulation | TransactionSimulationError} [simulation] - The transaction simulation result
   * @returns {{ results: Array<ThreatAnalysisResult>; balanceChanges: BalanceChanges }} Object containing threat results and balance changes
   */
  private analyzeSimulation(
    safeAddress: Address,
    simulation?: TransactionSimulation | TransactionSimulationError,
  ): [Array<ThreatAnalysisResult>, Array<BalanceChange> | undefined] {
    let results: Array<ThreatAnalysisResult> = [];
    let balanceChanges: Array<BalanceChange> = [];

    if (!simulation) {
      return [results, balanceChanges];
    }

    if (simulation.status === 'Error') {
      results = [
        this.mapToAnalysisResult({
          type: 'FAILED',
          error: simulation.description || simulation.error,
        }),
      ];
      return [results, undefined];
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
                type: 'MASTERCOPY_CHANGE',
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

    return [results, balanceChanges];
  }

  /**
   * Groups validation issues by their severity.
   * @param {Array<{ type: string; description: string }>} features - List of features detected during threat analysis
   * @returns {Map<keyof typeof Severity, Array<string>>} Partial record of issues grouped by severity (highest to lowest)
   */
  private groupIssuesBySeverity(
    features: Array<{ type: string; description: string }>,
  ): Partial<Record<keyof typeof Severity, Array<string>>> {
    if (!features.length) {
      return {};
    }

    const grouped = features
      .filter((f) => f.type === 'Malicious' || f.type === 'Warning')
      .reduce(
        (acc, { type, description }) => {
          const sev = BLOCKAID_SEVERITY_MAP[type];
          (acc[sev] ??= []).push(description);
          return acc;
        },
        {} as Partial<Record<keyof typeof Severity, Array<string>>>,
      );

    return Object.fromEntries(
      (
        Object.entries(grouped) as Array<[keyof typeof Severity, Array<string>]>
      ).sort(([a], [b]) => compareSeverityString(b, a)),
    ) as Partial<Record<keyof typeof Severity, Array<string>>>;
  }

  /**
   * Maps a threat analysis status to an analysis result.
   * @param {Object} args - The mapping parameters
   * @param {ThreatStatus | CommonStatus} args.type - The threat status
   * @param {string} args.reason - A description about the reasons the transaction was flagged with the type
   * @param {string} args.classification - A classification explaining the reason of threat analysis result
   * @param {string} args.description - A fallback description from Blockaid in case specific mappings are not found for reason/classification
   * @param {Map<keyof typeof Severity, Array<string>>} args.issues - A potential partial record of specific issues identified during threat analysis, grouped by severity
   * @param {string} args.before - The old master copy address (only for MASTERCOPY_CHANGE)
   * @param {string} args.after - The new master copy address (only for MASTERCOPY_CHANGE)
   * @param {string} args.error - An error message in case of a failure
   * @returns {ThreatAnalysisResult} The analysis result
   */
  private mapToAnalysisResult(args: {
    type: ThreatStatus | CommonStatus;
    reason?: string;
    classification?: string;
    description?: string;
    issues?: Partial<Record<keyof typeof Severity, Array<string>>>;
    before?: string;
    after?: string;
    error?: string;
  }): ThreatAnalysisResult {
    const {
      type,
      reason,
      classification,
      description: scanDescription,
      issues,
      before,
      after,
      error,
    } = args;
    const severity = SEVERITY_MAPPING[type];
    const title = TITLE_MAPPING[type];
    const descriptionMsg = prepareDescription(
      reason,
      classification,
      scanDescription,
    );

    const description = DESCRIPTION_MAPPING[type]({
      description: descriptionMsg,
      error,
    });

    switch (type) {
      case 'MASTERCOPY_CHANGE':
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
   * Returns a failed threat analysis response.
   * @returns {ThreatAnalysisResponse} A response indicating analysis failure
   */
  public failedAnalysisResponse(): ThreatAnalysisResponse {
    return { THREAT: [this.mapToAnalysisResult({ type: 'FAILED' })] };
  }
}
