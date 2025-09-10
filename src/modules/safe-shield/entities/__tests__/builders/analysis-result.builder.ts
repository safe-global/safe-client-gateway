import { faker } from '@faker-js/faker';
import {
  type AnalysisResult,
  type RecipientAnalysisResult,
  type ContractAnalysisResult,
  type ThreatAnalysisResult,
  type AnalysisStatus,
} from '../../analysis-result.entity';
import { Severity } from '../../severity.entity';
import { RecipientStatus } from '../../recipient-status.entity';
import { BridgeStatus } from '../../bridge-status.entity';
import { ContractStatus } from '../../contract-status.entity';
import { ThreatStatus } from '../../threat-status.entity';

/**
 * Builder for creating test AnalysisResult objects
 */
export class AnalysisResultBuilder<T extends AnalysisStatus> {
  private severity: Severity = Severity.INFO;
  private type: T;
  private title: string = faker.lorem.sentence();
  private description: string = faker.lorem.paragraph();

  constructor(type: T) {
    this.type = type;
  }

  static recipient(
    type: RecipientStatus = RecipientStatus.KNOWN_RECIPIENT,
  ): AnalysisResultBuilder<RecipientStatus> {
    return new AnalysisResultBuilder(type);
  }

  static bridge(
    type: BridgeStatus = BridgeStatus.INCOMPATIBLE_SAFE,
  ): AnalysisResultBuilder<BridgeStatus> {
    return new AnalysisResultBuilder(type);
  }

  static contract(
    type: ContractStatus = ContractStatus.VERIFIED,
  ): AnalysisResultBuilder<ContractStatus> {
    return new AnalysisResultBuilder(type);
  }

  static threat(
    type: ThreatStatus = ThreatStatus.NO_THREAT,
  ): AnalysisResultBuilder<ThreatStatus> {
    return new AnalysisResultBuilder(type);
  }

  withSeverity(severity: Severity): this {
    this.severity = severity;
    return this;
  }

  withType(type: T): this {
    this.type = type;
    return this;
  }

  withTitle(title: string): this {
    this.title = title;
    return this;
  }

  withDescription(description: string): this {
    this.description = description;
    return this;
  }

  critical(): this {
    return this.withSeverity(Severity.CRITICAL);
  }

  warn(): this {
    return this.withSeverity(Severity.WARN);
  }

  info(): this {
    return this.withSeverity(Severity.INFO);
  }

  ok(): this {
    return this.withSeverity(Severity.OK);
  }

  build(): AnalysisResult<T> {
    return {
      severity: this.severity,
      type: this.type,
      title: this.title,
      description: this.description,
    };
  }
}

/**
 * Convenience builders for specific analysis types
 */
export const buildRecipientAnalysisResult = (
  overrides: Partial<RecipientAnalysisResult> = {},
): RecipientAnalysisResult => ({
  severity: Severity.INFO,
  type: RecipientStatus.KNOWN_RECIPIENT,
  title: faker.lorem.sentence(),
  description: faker.lorem.paragraph(),
  ...overrides,
});

export const buildContractAnalysisResult = (
  overrides: Partial<ContractAnalysisResult> = {},
): ContractAnalysisResult => ({
  severity: Severity.INFO,
  type: ContractStatus.VERIFIED,
  title: faker.lorem.sentence(),
  description: faker.lorem.paragraph(),
  ...overrides,
});

export const buildThreatAnalysisResult = (
  overrides: Partial<ThreatAnalysisResult> = {},
): ThreatAnalysisResult => ({
  severity: Severity.OK,
  type: ThreatStatus.NO_THREAT,
  title: faker.lorem.sentence(),
  description: faker.lorem.paragraph(),
  ...overrides,
});
