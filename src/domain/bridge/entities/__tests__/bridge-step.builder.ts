import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { gasCostBuilder } from '@/domain/bridge/entities/__tests__/bridge-quote.builder';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { typedDataBuilder } from '@/routes/messages/entities/__tests__/typed-data.builder';
import { Builder } from '@/__tests__/builder';
import type {
  CallAction,
  SwapStep,
  CrossStep,
  CustomStep,
  ProtocolStep,
  Action,
  Estimate,
  StepToolDetails,
  TransactionRequest,
} from '@/domain/bridge/entities/bridge-step.entity';
import type { IBuilder } from '@/__tests__/builder';
import { fakeJson } from '@/__tests__/faker';
import { feeCostBuilder } from '@/domain/bridge/entities/__tests__/fee-cost.builder';

export function actionBuilder<
  T extends Action | CallAction = Action,
>(): IBuilder<T> {
  return new Builder<T>()
    .with('fromChainId', faker.string.numeric())
    .with('fromAmount', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('fromToken', tokenBuilder().build())
    .with('fromAddress', getAddress(faker.finance.ethereumAddress()))
    .with('toChainId', faker.string.numeric())
    .with('toToken', tokenBuilder().build())
    .with('toAddress', getAddress(faker.finance.ethereumAddress()))
    .with('slippage', faker.number.float({ min: 0, max: 1 }));
}

export function estimateBuilder(): IBuilder<Estimate> {
  return new Builder<Estimate>()
    .with('tool', faker.word.sample())
    .with('fromAmount', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with(
      'fromAmountUSD',
      faker.number.float({ min: 0, max: 1_000 }).toString(),
    )
    .with('toAmount', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('toAmountMin', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('toAmountUSD', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('approvalAddress', getAddress(faker.finance.ethereumAddress()))
    .with(
      'feeCosts',
      faker.helpers.multiple(() => feeCostBuilder().build(), {
        count: { min: 1, max: 5 },
      }),
    )
    .with(
      'gasCosts',
      faker.helpers.multiple(() => gasCostBuilder().build(), {
        count: { min: 1, max: 5 },
      }),
    )
    .with('executionDuration', faker.number.int({ min: 0, max: 100 }));
}

export function stepToolDetailsBuilder(): IBuilder<StepToolDetails> {
  return new Builder<StepToolDetails>()
    .with('key', faker.word.sample())
    .with('name', faker.word.sample())
    .with('logoURI', faker.internet.url({ appendSlash: false }));
}

export function transactionRequestBuilder(): IBuilder<TransactionRequest> {
  return new Builder<TransactionRequest>()
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('from', getAddress(faker.finance.ethereumAddress()))
    .with('nonce', faker.number.int({ min: 0, max: 100 }))
    .with('gasLimit', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('gasPrice', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('data', faker.string.hexadecimal({ length: 64 }) as `0x${string}`)
    .with('value', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('chainId', faker.string.numeric())
    .with('type', faker.number.int({ min: 1, max: 128 }))
    .with(
      'accessList',
      faker.helpers.multiple(() => ({
        address: getAddress(faker.finance.ethereumAddress()),
        storageKeys: faker.helpers.multiple(() => faker.string.hexadecimal(), {
          count: { min: 1, max: 5 },
        }),
      })),
    )
    .with(
      'maxPriorityFeePerGas',
      faker.number.float({ min: 0, max: 1_000 }).toString(),
    )
    .with('maxFeePerGas', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('customData', JSON.parse(fakeJson()) as Record<string, unknown>)
    .with('ccipReadEnabled', faker.datatype.boolean());
}

export function stepBaseBuilder<
  T extends SwapStep | CrossStep | CustomStep | ProtocolStep,
>(): IBuilder<T> {
  return new Builder<T>()
    .with('id', faker.string.uuid())
    .with('tool', faker.word.sample())
    .with('toolDetails', stepToolDetailsBuilder().build())
    .with('integrator', faker.word.sample())
    .with('referrer', faker.word.sample())
    .with('action', actionBuilder().build())
    .with('estimate', estimateBuilder().build())
    .with('transactionRequest', transactionRequestBuilder().build())
    .with(
      'typedData',
      faker.helpers.multiple(() => typedDataBuilder().build(), {
        count: { min: 1, max: 5 },
      }),
    );
}

export function swapStepBuilder<T extends SwapStep>(): IBuilder<T> {
  return stepBaseBuilder<T>()
    .with('type', 'swap')
    .with('action', actionBuilder().build());
}

export function crossStepBuilder<T extends CrossStep>(): IBuilder<T> {
  return stepBaseBuilder<T>()
    .with('type', 'cross')
    .with('action', actionBuilder().build());
}

export function protocolStepBuilder<T extends ProtocolStep>(): IBuilder<T> {
  return stepBaseBuilder<T>()
    .with('type', 'protocol')
    .with('action', actionBuilder().build());
}

export function callActionBuilder<T extends CallAction>(): IBuilder<T> {
  return actionBuilder<T>()
    .with('toContractAddress', getAddress(faker.finance.ethereumAddress()))
    .with('toContractCallData', faker.string.hexadecimal() as `0x${string}`)
    .with('toFallbackAddress', getAddress(faker.finance.ethereumAddress()))
    .with(
      'callDataGasLimit',
      faker.number.float({ min: 0, max: 1_000 }).toString(),
    );
}

export function customStepBuilder<T extends CustomStep>(): IBuilder<T> {
  return stepBaseBuilder<T>()
    .with('type', 'custom')
    .with('action', callActionBuilder().build());
}

export function stepBuilder(): IBuilder<
  SwapStep | CrossStep | ProtocolStep | CustomStep
> {
  return faker.helpers.arrayElement([
    swapStepBuilder(),
    crossStepBuilder(),
    protocolStepBuilder(),
    customStepBuilder(),
  ]);
}
