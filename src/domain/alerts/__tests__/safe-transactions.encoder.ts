import { faker } from '@faker-js/faker';
import { parseAbi, encodeFunctionData, getAddress, Hex, pad } from 'viem';

import { Safe } from '@/domain/safe/entities/safe.entity';
import { EncoderBuilder, IEncoderBuilder } from '@/__tests__/encoder-builder';

const ZERO_ADDRESS = pad('0x0', { size: 20 });
const SENTINEL_ADDRESS = pad('0x1', { dir: 'left', size: 20 });

const MAX_THRESHOLD = 10;

function getPrevOwner(ownerToRemove: Hex, owners?: Safe['owners']): Hex {
  if (!owners) {
    return SENTINEL_ADDRESS;
  }

  const ownerIndex = owners.findIndex((owner) => {
    return owner.toLowerCase() === ownerToRemove.toLowerCase();
  });

  return ownerIndex <= 0
    ? SENTINEL_ADDRESS
    : getAddress(owners[ownerIndex - 1]);
}

// execTransaction

type ExecTransactionArgs = {
  to: Hex;
  value: bigint;
  data: Hex;
  operation: 0 | 1;
  safeTxGas: bigint;
  baseGas: bigint;
  gasPrice: bigint;
  gasToken: Hex;
  refundReceiver: Hex;
  signatures: Hex;
};

class ExecTransactionEncoder<
  T extends ExecTransactionArgs,
> extends EncoderBuilder<T> {
  static readonly FUNCTION_SIGNATURE =
    'function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures)' as const;

  encode() {
    const abi = parseAbi([ExecTransactionEncoder.FUNCTION_SIGNATURE]);

    const args = this.build();

    return encodeFunctionData({
      abi,
      functionName: 'execTransaction',
      args: [
        args.to,
        args.value,
        args.data,
        args.operation,
        args.safeTxGas,
        args.baseGas,
        args.gasPrice,
        args.gasToken,
        args.refundReceiver,
        args.signatures,
      ],
    });
  }
}

export function execTransactionEncoder(): IEncoderBuilder<ExecTransactionArgs> {
  return ExecTransactionEncoder.new<ExecTransactionArgs>()
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('value', BigInt(0))
    .with('data', '0x')
    .with('operation', 0)
    .with('safeTxGas', BigInt(0))
    .with('baseGas', BigInt(0))
    .with('gasPrice', BigInt(0))
    .with('gasToken', ZERO_ADDRESS)
    .with('refundReceiver', ZERO_ADDRESS)
    .with('signatures', '0x');
}

// addOwnerWithThreshold

type AddOwnerWithThresholdArgs = {
  owner: Hex;
  threshold: bigint;
};

class AddOwnerWithThresholdEncoder<
  T extends AddOwnerWithThresholdArgs,
> extends EncoderBuilder<T> {
  static readonly FUNCTION_SIGNATURE =
    'function addOwnerWithThreshold(address owner, uint256 _threshold)' as const;

  encode() {
    const abi = parseAbi([AddOwnerWithThresholdEncoder.FUNCTION_SIGNATURE]);

    const args = this.build();

    return encodeFunctionData({
      abi,
      functionName: 'addOwnerWithThreshold',
      args: [args.owner, args.threshold],
    });
  }
}

export function addOwnerWithThresholdEncoder(): IEncoderBuilder<AddOwnerWithThresholdArgs> {
  return AddOwnerWithThresholdEncoder.new<AddOwnerWithThresholdArgs>()
    .with('owner', getAddress(faker.finance.ethereumAddress()))
    .with('threshold', faker.number.bigInt({ min: 1, max: MAX_THRESHOLD }));
}

// removeOwner

type RemoveOwnerArgs = {
  prevOwner: Hex;
  owner: Hex;
  threshold: bigint;
};

class RemoveOwnerEncoder<T extends RemoveOwnerArgs> extends EncoderBuilder<T> {
  static readonly FUNCTION_SIGNATURE =
    'function removeOwner(address prevOwner, address owner, uint256 _threshold)';

  encode() {
    const abi = parseAbi([RemoveOwnerEncoder.FUNCTION_SIGNATURE]);

    const args = this.build();

    return encodeFunctionData({
      abi,
      functionName: 'removeOwner',
      args: [args.prevOwner, args.owner, args.threshold],
    });
  }
}

export function removeOwnerEncoder(
  owners?: Safe['owners'],
): IEncoderBuilder<RemoveOwnerArgs> {
  const owner = getAddress(faker.finance.ethereumAddress());
  const prevOwner = getPrevOwner(owner, owners);

  return RemoveOwnerEncoder.new<RemoveOwnerArgs>()
    .with('prevOwner', prevOwner)
    .with('owner', owner)
    .with('threshold', faker.number.bigInt({ min: 1, max: MAX_THRESHOLD }));
}

// swapOwner

type SwapOwnerArgs = {
  prevOwner: Hex;
  oldOwner: Hex;
  newOwner: Hex;
};

class SwapOwnerEncoder<T extends SwapOwnerArgs> extends EncoderBuilder<T> {
  static readonly FUNCTION_SIGNATURE =
    'function swapOwner(address prevOwner, address oldOwner, address newOwner)';

  encode() {
    const abi = parseAbi([SwapOwnerEncoder.FUNCTION_SIGNATURE]);

    const args = this.build();

    return encodeFunctionData({
      abi,
      functionName: 'swapOwner',
      args: [args.prevOwner, args.oldOwner, args.newOwner],
    });
  }
}

export function swapOwnerEncoder(
  owners?: Safe['owners'],
): IEncoderBuilder<SwapOwnerArgs> {
  const oldOwner = getAddress(faker.finance.ethereumAddress());
  const prevOwner = getPrevOwner(oldOwner, owners);

  return SwapOwnerEncoder.new<SwapOwnerArgs>()
    .with('prevOwner', prevOwner)
    .with('oldOwner', oldOwner)
    .with('newOwner', getAddress(faker.finance.ethereumAddress()));
}

// changeThreshold

type ChangeThresholdArgs = {
  threshold: bigint;
};

class ChangeThresholdEncoder<
  T extends ChangeThresholdArgs,
> extends EncoderBuilder<T> {
  static readonly FUNCTION_SIGNATURE =
    'function changeThreshold(uint256 _threshold)';

  encode() {
    const abi = parseAbi([ChangeThresholdEncoder.FUNCTION_SIGNATURE]);

    const args = this.build();

    return encodeFunctionData({
      abi,
      functionName: 'changeThreshold',
      args: [args.threshold],
    });
  }
}

export function changeThresholdEncoder(): IEncoderBuilder<ChangeThresholdArgs> {
  return ChangeThresholdEncoder.new<ChangeThresholdArgs>().with(
    'threshold',
    faker.number.bigInt({ min: 1, max: MAX_THRESHOLD }),
  );
}
