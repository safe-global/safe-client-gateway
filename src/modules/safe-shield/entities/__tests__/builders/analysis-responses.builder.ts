import { faker } from '@faker-js/faker';
import {
  type RecipientAnalysisResponse,
  type ContractAnalysisResponse,
  type ThreatAnalysisResponse,
} from '../../analysis-responses.entity';
import {
  type RecipientAnalysisResult,
  type ContractAnalysisResult,
} from '../../analysis-result.entity';
import type {
  RecipientStatusGroup,
  ContractStatusGroup,
} from '../../status-group.entity';
import { StatusGroup } from '../../status-group.entity';
import { Severity } from '../../severity.entity';
import { RecipientStatus } from '../../recipient-status.entity';
import { BridgeStatus } from '../../bridge-status.entity';
import { ContractStatus } from '../../contract-status.entity';
import { ThreatStatus } from '../../threat-status.entity';
import {
  buildRecipientAnalysisResult,
  buildContractAnalysisResult,
} from './analysis-result.builder';

/**
 * Builder for RecipientAnalysisResponse
 */
export class RecipientAnalysisResponseBuilder {
  private response: RecipientAnalysisResponse = {};

  static new(): RecipientAnalysisResponseBuilder {
    return new RecipientAnalysisResponseBuilder();
  }

  withAddress(address: string): AddressBuilder {
    return new AddressBuilder(this, address);
  }

  withRandomAddress(): AddressBuilder {
    return this.withAddress(faker.finance.ethereumAddress());
  }

  build(): RecipientAnalysisResponse {
    return { ...this.response };
  }

  // Internal method for AddressBuilder to add results
  _addResults(
    address: string,
    statusGroup: RecipientStatusGroup,
    results: Array<RecipientAnalysisResult>,
  ): this {
    const typedAddress = address as `0x${string}`;
    if (!this.response[typedAddress]) {
      this.response[typedAddress] = {};
    }
    this.response[typedAddress][statusGroup] = results;
    return this;
  }
}

class AddressBuilder {
  constructor(
    private parent: RecipientAnalysisResponseBuilder,
    private address: string,
  ) {}

  withRecipientInteraction(
    results: Array<RecipientAnalysisResult> = [buildRecipientAnalysisResult()],
  ): this {
    this.parent._addResults(
      this.address,
      StatusGroup.RECIPIENT_INTERACTION,
      results,
    );
    return this;
  }

  withBridge(
    results: Array<RecipientAnalysisResult> = [
      buildRecipientAnalysisResult({ type: BridgeStatus.INCOMPATIBLE_SAFE }),
    ],
  ): this {
    this.parent._addResults(this.address, StatusGroup.BRIDGE, results);
    return this;
  }

  withKnownRecipient(): this {
    return this.withRecipientInteraction([
      buildRecipientAnalysisResult({
        severity: Severity.INFO,
        type: RecipientStatus.KNOWN_RECIPIENT,
        title: 'Known recipient',
        description: 'You have interacted with this address before',
      }),
    ]);
  }

  withNewRecipient(): this {
    return this.withRecipientInteraction([
      buildRecipientAnalysisResult({
        severity: Severity.WARN,
        type: RecipientStatus.NEW_RECIPIENT,
        title: 'New recipient',
        description: 'First time interacting with this address',
      }),
    ]);
  }

  withIncompatibleSafe(): this {
    return this.withBridge([
      buildRecipientAnalysisResult({
        severity: Severity.WARN,
        type: BridgeStatus.INCOMPATIBLE_SAFE,
        title: 'Incompatible Safe',
        description: 'Target Safe version incompatible',
      }),
    ]);
  }

  and(): RecipientAnalysisResponseBuilder {
    return this.parent;
  }

  build(): RecipientAnalysisResponse {
    return this.parent.build();
  }
}

/**
 * Builder for ContractAnalysisResponse
 */
export class ContractAnalysisResponseBuilder {
  private response: ContractAnalysisResponse = {};

  static new(): ContractAnalysisResponseBuilder {
    return new ContractAnalysisResponseBuilder();
  }

  withAddress(address: string): ContractAddressBuilder {
    return new ContractAddressBuilder(this, address);
  }

  withRandomAddress(): ContractAddressBuilder {
    return this.withAddress(faker.finance.ethereumAddress());
  }

  build(): ContractAnalysisResponse {
    return { ...this.response };
  }

  _addResults(
    address: string,
    statusGroup: ContractStatusGroup,
    results: Array<ContractAnalysisResult>,
  ): this {
    const typedAddress = address as `0x${string}`;
    if (!this.response[typedAddress]) {
      this.response[typedAddress] = {};
    }
    this.response[typedAddress][statusGroup] = results;
    return this;
  }
}

class ContractAddressBuilder {
  constructor(
    private parent: ContractAnalysisResponseBuilder,
    private address: string,
  ) {}

  withVerification(
    results: Array<ContractAnalysisResult> = [buildContractAnalysisResult()],
  ): this {
    this.parent._addResults(
      this.address,
      StatusGroup.CONTRACT_VERIFICATION,
      results,
    );
    return this;
  }

  withInteraction(
    results: Array<ContractAnalysisResult> = [buildContractAnalysisResult()],
  ): this {
    this.parent._addResults(
      this.address,
      StatusGroup.CONTRACT_INTERACTION,
      results,
    );
    return this;
  }

  withDelegatecall(
    results: Array<ContractAnalysisResult> = [
      buildContractAnalysisResult({
        type: ContractStatus.UNEXPECTED_DELEGATECALL,
      }),
    ],
  ): this {
    this.parent._addResults(this.address, StatusGroup.DELEGATECALL, results);
    return this;
  }

  withVerified(): this {
    return this.withVerification([
      buildContractAnalysisResult({
        severity: Severity.OK,
        type: ContractStatus.VERIFIED,
        title: 'Verified contract',
        description: 'Contract source code is verified',
      }),
    ]);
  }

  withNotVerified(): this {
    return this.withVerification([
      buildContractAnalysisResult({
        severity: Severity.WARN,
        type: ContractStatus.NOT_VERIFIED,
        title: 'Unverified contract',
        description: 'Contract source code is not verified',
      }),
    ]);
  }

  withKnownContract(): this {
    return this.withInteraction([
      buildContractAnalysisResult({
        severity: Severity.INFO,
        type: ContractStatus.KNOWN_CONTRACT,
        title: 'Known contract',
        description: 'You have interacted with this contract before',
      }),
    ]);
  }

  withUnexpectedDelegatecall(): this {
    return this.withDelegatecall([
      buildContractAnalysisResult({
        severity: Severity.CRITICAL,
        type: ContractStatus.UNEXPECTED_DELEGATECALL,
        title: 'Unexpected delegatecall',
        description: 'Potentially dangerous delegatecall detected',
      }),
    ]);
  }

  and(): ContractAnalysisResponseBuilder {
    return this.parent;
  }

  build(): ContractAnalysisResponse {
    return this.parent.build();
  }
}

/**
 * Builder for ThreatAnalysisResponse
 */
export class ThreatAnalysisResponseBuilder {
  private severity: Severity = Severity.OK;
  private type: ThreatStatus = ThreatStatus.NO_THREAT;
  private title: string = faker.lorem.sentence();
  private description: string = faker.lorem.paragraph();

  static new(): ThreatAnalysisResponseBuilder {
    return new ThreatAnalysisResponseBuilder();
  }

  withSeverity(severity: Severity): this {
    this.severity = severity;
    return this;
  }

  withType(type: ThreatStatus): this {
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

  noThreat(): this {
    return this.withSeverity(Severity.OK)
      .withType(ThreatStatus.NO_THREAT)
      .withTitle('No threats detected')
      .withDescription('Transaction appears safe');
  }

  malicious(): this {
    return this.withSeverity(Severity.CRITICAL)
      .withType(ThreatStatus.MALICIOUS)
      .withTitle('Malicious transaction detected')
      .withDescription('This transaction contains known malicious patterns');
  }

  ownershipChange(): this {
    return this.withSeverity(Severity.CRITICAL)
      .withType(ThreatStatus.OWNERSHIP_CHANGE)
      .withTitle('Ownership change')
      .withDescription('Transaction modifies Safe ownership');
  }

  moduleChange(): this {
    return this.withSeverity(Severity.WARN)
      .withType(ThreatStatus.MODULE_CHANGE)
      .withTitle('Module change')
      .withDescription('Transaction modifies Safe modules');
  }

  masterCopyChange(): this {
    return this.withSeverity(Severity.CRITICAL)
      .withType(ThreatStatus.MASTER_COPY_CHANGE)
      .withTitle('Master copy change')
      .withDescription('Transaction changes Safe implementation');
  }

  failed(): this {
    return this.withSeverity(Severity.INFO)
      .withType(ThreatStatus.FAILED)
      .withTitle('Analysis failed')
      .withDescription('Threat analysis service unavailable');
  }

  build(): ThreatAnalysisResponse {
    return {
      severity: this.severity,
      type: this.type,
      title: this.title,
      description: this.description,
    };
  }
}

/**
 * Convenience functions for quick building
 */
export const buildRecipientAnalysisResponse = (
  overrides: RecipientAnalysisResponse = {},
): RecipientAnalysisResponse => ({
  ...new RecipientAnalysisResponseBuilder().build(),
  ...overrides,
});

export const buildContractAnalysisResponse = (
  overrides: ContractAnalysisResponse = {},
): ContractAnalysisResponse => ({
  ...new ContractAnalysisResponseBuilder().build(),
  ...overrides,
});

export const buildThreatAnalysisResponse = (
  overrides: Partial<ThreatAnalysisResponse> = {},
): ThreatAnalysisResponse => ({
  ...new ThreatAnalysisResponseBuilder().build(),
  ...overrides,
});
