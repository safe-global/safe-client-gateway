// SPDX-License-Identifier: FSL-1.1-MIT
import { type Address, formatUnits, isAddressEqual } from 'viem';
import type { Balance } from '@/modules/balances/domain/entities/balance.entity';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import type {
  BaseDataDecoded,
  DataDecoded,
  DataDecodedParameter,
} from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

const EMPTY_DATA = '0x';
const MULTI_SEND_METHOD = 'multiSend';
// ERC-20 `decimals()` is a uint8; anything larger is corrupt metadata.
const MAX_TOKEN_DECIMALS = 255;

/**
 * ERC-20 methods that move or expose value, mapped to the index of the amount
 * parameter. Approvals count as exposure: an unlimited approval to the wrong
 * spender is as good as a transfer.
 */
const VALUE_METHOD_AMOUNT_INDEX: Record<string, number> = {
  transfer: 1,
  transferFrom: 2,
  approve: 1,
  increaseAllowance: 1,
};

export type ValueLeg = {
  kind: 'native' | 'erc20';
  tokenAddress: Address | null;
  amount: bigint;
  method: string | null;
  // Recipient or spender, when the method has one.
  counterparty: Address | null;
};

export type Call = {
  to: Address;
  operation: Operation;
  method: string | null;
  hasData: boolean;
};

export type TransactionAnalysis = {
  legs: Array<ValueLeg>;
  calls: Array<Call>;
  isMultiSend: boolean;
};

export type LegValuation = ValueLeg & {
  symbol: string | null;
  formattedAmount: string | null;
  fiatValue: number | null;
};

export type TransactionValuation = {
  legs: Array<LegValuation>;
  isMultiSend: boolean;
  // Sum of the legs whose fiat value is known.
  knownFiatValue: number;
  hasUnknownValue: boolean;
};

function parameterAt(
  decoded: BaseDataDecoded,
  index: number,
): DataDecodedParameter | undefined {
  return decoded.parameters?.[index];
}

function toAddress(value: unknown): Address | null {
  const parsed = AddressSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function toAmount(value: unknown): bigint | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function analyzeCall(
  args: {
    to: Address;
    value: bigint;
    operation: Operation;
    data: string | null;
    decoded: BaseDataDecoded | null;
  },
  into: TransactionAnalysis,
): void {
  const hasData = !!args.data && args.data !== EMPTY_DATA;
  const method = args.decoded?.method ?? null;
  into.calls.push({ to: args.to, operation: args.operation, method, hasData });

  if (args.value > 0n) {
    into.legs.push({
      kind: 'native',
      tokenAddress: null,
      amount: args.value,
      method,
      counterparty: hasData ? null : args.to,
    });
  }

  if (!args.decoded) {
    return;
  }

  if (args.decoded.method === MULTI_SEND_METHOD) {
    into.isMultiSend = true;
    const inner = parameterAt(args.decoded, 0)?.valueDecoded;
    if (Array.isArray(inner)) {
      for (const call of inner) {
        analyzeCall(
          {
            to: call.to,
            value: toAmount(call.value) ?? 0n,
            operation: call.operation,
            data: call.data,
            decoded: call.dataDecoded,
          },
          into,
        );
      }
    }
    return;
  }

  const amountIndex = VALUE_METHOD_AMOUNT_INDEX[args.decoded.method];
  if (amountIndex === undefined) {
    return;
  }
  const amount = toAmount(parameterAt(args.decoded, amountIndex)?.value);
  if (amount === null) {
    return;
  }
  const counterpartyIndex = args.decoded.method === 'transferFrom' ? 1 : 0;
  into.legs.push({
    kind: 'erc20',
    tokenAddress: args.to,
    amount,
    method: args.decoded.method,
    counterparty: toAddress(
      parameterAt(args.decoded, counterpartyIndex)?.value,
    ),
  });
}

/**
 * Flattens a multisig transaction (and any MultiSend batch inside it) into
 * the value it moves and the contracts it calls.
 */
export function analyzeTransaction(args: {
  transaction: Pick<MultisigTransaction, 'to' | 'value' | 'data' | 'operation'>;
  dataDecoded: DataDecoded | null;
}): TransactionAnalysis {
  const analysis: TransactionAnalysis = {
    legs: [],
    calls: [],
    isMultiSend: false,
  };
  analyzeCall(
    {
      to: args.transaction.to,
      value: toAmount(args.transaction.value) ?? 0n,
      operation: args.transaction.operation,
      data: args.transaction.data,
      decoded: args.dataDecoded,
    },
    analysis,
  );
  return analysis;
}

function findBalance(
  balances: Array<Balance>,
  tokenAddress: Address | null,
): Balance | undefined {
  return balances.find((balance) =>
    tokenAddress === null
      ? balance.tokenAddress === null
      : balance.tokenAddress !== null &&
        isAddressEqual(balance.tokenAddress, tokenAddress),
  );
}

/**
 * Prices each value leg with the Safe's own balance list, which already
 * carries a fiat conversion per token. A token the Safe does not hold, or one
 * without a price, is an unknown value and is surfaced as such rather than
 * silently counted as zero.
 */
export function valueTransaction(args: {
  analysis: TransactionAnalysis;
  balances: Array<Balance>;
  chain: Chain;
}): TransactionValuation {
  const legs = args.analysis.legs.map((leg): LegValuation => {
    const balance = findBalance(args.balances, leg.tokenAddress);
    const rawDecimals =
      leg.kind === 'native'
        ? args.chain.nativeCurrency.decimals
        : (balance?.token?.decimals ?? null);
    const decimals =
      rawDecimals !== null &&
      Number.isInteger(rawDecimals) &&
      rawDecimals >= 0 &&
      rawDecimals <= MAX_TOKEN_DECIMALS
        ? rawDecimals
        : null;
    const symbol =
      leg.kind === 'native'
        ? args.chain.nativeCurrency.symbol
        : (balance?.token?.symbol ?? null);
    const formattedAmount =
      decimals === null ? null : formatUnits(leg.amount, decimals);
    const conversion = balance?.fiatConversion
      ? Number(balance.fiatConversion)
      : null;
    const fiatValue =
      formattedAmount !== null &&
      conversion !== null &&
      Number.isFinite(conversion)
        ? Number(formattedAmount) * conversion
        : null;
    return { ...leg, symbol, formattedAmount, fiatValue };
  });

  return {
    legs,
    isMultiSend: args.analysis.isMultiSend,
    knownFiatValue: legs.reduce((sum, leg) => sum + (leg.fiatValue ?? 0), 0),
    hasUnknownValue: legs.some((leg) => leg.fiatValue === null),
  };
}

/**
 * The contracts this transaction would call, i.e. every target with calldata.
 * Plain native transfers are not interactions.
 */
export function getCalledContracts(
  analysis: TransactionAnalysis,
): Array<Address> {
  const unique = new Map<string, Address>();
  for (const call of analysis.calls) {
    if (call.hasData) {
      unique.set(call.to.toLowerCase(), call.to);
    }
  }
  return [...unique.values()];
}

export function hasDelegateCallOutside(
  analysis: TransactionAnalysis,
  allowed: Array<Address>,
): boolean {
  return analysis.calls.some(
    (call) =>
      call.operation === Operation.DELEGATE &&
      !allowed.some((address) => isAddressEqual(address, call.to)),
  );
}

export function touchesAddress(
  analysis: TransactionAnalysis,
  address: Address,
): boolean {
  return analysis.calls.some(
    (call) => call.hasData && isAddressEqual(call.to, address),
  );
}
