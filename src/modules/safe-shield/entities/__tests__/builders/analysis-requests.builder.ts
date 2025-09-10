import { faker } from '@faker-js/faker';
import {
  type RecipientAnalysisRequestBody,
  type ContractAnalysisRequestBody,
  type ThreatAnalysisRequestBody,
} from '../../analysis-requests.entity';

/**
 * Builder for RecipientAnalysisRequestBody
 */
export class RecipientAnalysisRequestBuilder {
  private data: `0x${string}` = faker.string.hexadecimal({ length: 128 }) as `0x${string}`;

  static new(): RecipientAnalysisRequestBuilder {
    return new RecipientAnalysisRequestBuilder();
  }

  withData(data: `0x${string}`): this {
    this.data = data;
    return this;
  }

  withEmptyData(): this {
    return this.withData('0x');
  }

  withInvalidData(): this {
    return this.withData('invalid-hex' as `0x${string}`);
  }

  build(): RecipientAnalysisRequestBody {
    return {
      data: this.data,
    };
  }
}

/**
 * Builder for ContractAnalysisRequestBody
 */
export class ContractAnalysisRequestBuilder {
  private data: `0x${string}` = faker.string.hexadecimal({ length: 128 }) as `0x${string}`;
  private operation: number = 0;

  static new(): ContractAnalysisRequestBuilder {
    return new ContractAnalysisRequestBuilder();
  }

  withData(data: `0x${string}`): this {
    this.data = data;
    return this;
  }

  withOperation(operation: number): this {
    this.operation = operation;
    return this;
  }

  withDelegatecall(): this {
    return this.withOperation(1);
  }

  withCall(): this {
    return this.withOperation(0);
  }

  withInvalidOperation(): this {
    return this.withOperation(2);
  }

  build(): ContractAnalysisRequestBody {
    return {
      data: this.data,
      operation: this.operation,
    };
  }
}

/**
 * Builder for ThreatAnalysisRequestBody
 */
export class ThreatAnalysisRequestBuilder {
  private to: `0x${string}` = faker.finance.ethereumAddress() as `0x${string}`;
  private value: string = '1000000000000000000';
  private data: `0x${string}` = faker.string.hexadecimal({ length: 128 }) as `0x${string}`;
  private operation: number = 0;
  private safeTxGas: string = '100000';
  private baseGas: string = '21000';
  private gasPrice: string = '20000000000';
  private gasToken: `0x${string}` = '0x0000000000000000000000000000000000000000';
  private refundReceiver: `0x${string}` = '0x0000000000000000000000000000000000000000';
  private nonce: string = '1';

  static new(): ThreatAnalysisRequestBuilder {
    return new ThreatAnalysisRequestBuilder();
  }

  withTo(to: `0x${string}`): this {
    this.to = to;
    return this;
  }

  withValue(value: string): this {
    this.value = value;
    return this;
  }

  withData(data: `0x${string}`): this {
    this.data = data;
    return this;
  }

  withOperation(operation: number): this {
    this.operation = operation;
    return this;
  }

  withSafeTxGas(safeTxGas: string): this {
    this.safeTxGas = safeTxGas;
    return this;
  }

  withBaseGas(baseGas: string): this {
    this.baseGas = baseGas;
    return this;
  }

  withGasPrice(gasPrice: string): this {
    this.gasPrice = gasPrice;
    return this;
  }

  withGasToken(gasToken: `0x${string}`): this {
    this.gasToken = gasToken;
    return this;
  }

  withRefundReceiver(refundReceiver: `0x${string}`): this {
    this.refundReceiver = refundReceiver;
    return this;
  }

  withNonce(nonce: string): this {
    this.nonce = nonce;
    return this;
  }

  withDelegatecall(): this {
    return this.withOperation(1);
  }

  withInvalidAddress(): this {
    return this.withTo('invalid-address' as `0x${string}`);
  }

  withInvalidValue(): this {
    return this.withValue('not-a-number');
  }

  withInvalidNonce(): this {
    return this.withNonce('abc123');
  }

  build(): ThreatAnalysisRequestBody {
    return {
      to: this.to,
      value: this.value,
      data: this.data,
      operation: this.operation,
      safeTxGas: this.safeTxGas,
      baseGas: this.baseGas,
      gasPrice: this.gasPrice,
      gasToken: this.gasToken,
      refundReceiver: this.refundReceiver,
      nonce: this.nonce,
    };
  }
}

/**
 * Convenience functions for quick building
 */
export const buildRecipientAnalysisRequest = (
  overrides: Partial<RecipientAnalysisRequestBody> = {},
): RecipientAnalysisRequestBody => ({
  data: faker.string.hexadecimal({ length: 128 }) as `0x${string}`,
  ...overrides,
});

export const buildContractAnalysisRequest = (
  overrides: Partial<ContractAnalysisRequestBody> = {},
): ContractAnalysisRequestBody => ({
  data: faker.string.hexadecimal({ length: 128 }) as `0x${string}`,
  operation: 0,
  ...overrides,
});

export const buildThreatAnalysisRequest = (
  overrides: Partial<ThreatAnalysisRequestBody> = {},
): ThreatAnalysisRequestBody => ({
  to: faker.finance.ethereumAddress() as `0x${string}`,
  value: '1000000000000000000',
  data: faker.string.hexadecimal({ length: 128 }) as `0x${string}`,
  operation: 0,
  safeTxGas: '100000',
  baseGas: '21000',
  gasPrice: '20000000000',
  gasToken: '0x0000000000000000000000000000000000000000',
  refundReceiver: '0x0000000000000000000000000000000000000000',
  nonce: '1',
  ...overrides,
});
