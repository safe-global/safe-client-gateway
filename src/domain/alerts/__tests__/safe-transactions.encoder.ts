import { faker } from '@faker-js/faker';
import { parseAbi, encodeFunctionData, getAddress, Hex, pad } from 'viem';

import { Safe } from '@/domain/safe/entities/safe.entity';

const ZERO_ADDRESS = pad('0x0', { size: 20 });
const SENTINEL_ADDRESS = pad('0x1', { dir: 'left', size: 20 });

const MAX_THRESHOLD = 10;

// execTransaction

type ExecTransactionArgs = {
  to: string;
  value: bigint;
  data: string;
  operation: 0 | 1;
  safeTxGas: bigint;
  baseGas: bigint;
  gasPrice: bigint;
  gasToken: string;
  refundReceiver: string;
  signatures: string;
};

class ExecTransactionEncoder<T extends ExecTransactionArgs> {
  static readonly FUNCTION_SIGNATURE =
    'function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures)' as const;

  private constructor(private args: Partial<T>) {}

  public static new<
    T extends ExecTransactionArgs,
  >(): ExecTransactionEncoder<T> {
    return new ExecTransactionEncoder<T>({});
  }

  with<K extends keyof T>(key: K, value: T[K]) {
    const args: Partial<T> = { ...this.args, [key]: value };
    return new ExecTransactionEncoder(args);
  }

  build() {
    return {
      to: getAddress(this.args.to!),
      value: this.args.value!,
      data: this.args.data as Hex,
      operation: this.args.operation!,
      safeTxGas: this.args.safeTxGas!,
      baseGas: this.args.baseGas!,
      gasPrice: this.args.gasPrice!,
      gasToken: getAddress(this.args.gasToken!),
      refundReceiver: getAddress(this.args.refundReceiver!),
      signatures: this.args.signatures as Hex,
    };
  }

  encode(): Hex {
    const abi = parseAbi([ExecTransactionEncoder.FUNCTION_SIGNATURE]);

    const {
      to,
      value,
      data,
      operation,
      safeTxGas,
      baseGas,
      gasPrice,
      gasToken,
      refundReceiver,
      signatures,
    } = this.build();

    return encodeFunctionData({
      abi,
      functionName: 'execTransaction',
      args: [
        to,
        value,
        data,
        operation,
        safeTxGas,
        baseGas,
        gasPrice,
        gasToken,
        refundReceiver,
        signatures,
      ],
    });
  }
}

export function execTransactionEncoder() {
  return ExecTransactionEncoder.new()
    .with('to', faker.finance.ethereumAddress())
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
  owner: string;
  threshold: bigint;
};

class AddOwnerWithThresholdEncoder<T extends AddOwnerWithThresholdArgs> {
  static readonly FUNCTION_SIGNATURE =
    'function addOwnerWithThreshold(address owner, uint256 _threshold)' as const;

  private constructor(private args: Partial<T>) {}

  public static new<
    T extends AddOwnerWithThresholdArgs,
  >(): AddOwnerWithThresholdEncoder<T> {
    return new AddOwnerWithThresholdEncoder<T>({});
  }

  with<K extends keyof T>(key: K, value: T[K]) {
    const args: Partial<T> = { ...this.args, [key]: value };
    return new AddOwnerWithThresholdEncoder(args);
  }

  build() {
    return {
      owner: getAddress(this.args.owner!),
      threshold: this.args.threshold!,
    };
  }

  encode(): Hex {
    const abi = parseAbi([AddOwnerWithThresholdEncoder.FUNCTION_SIGNATURE]);

    const { owner, threshold } = this.build();

    return encodeFunctionData({
      abi,
      functionName: 'addOwnerWithThreshold',
      args: [owner, threshold],
    });
  }
}

export function addOwnerWithThresholdEncoder() {
  return AddOwnerWithThresholdEncoder.new()
    .with('owner', faker.finance.ethereumAddress())
    .with('threshold', faker.number.bigInt({ min: 1, max: MAX_THRESHOLD }));
}

// removeOwner

type RemoveOwnerArgs = {
  owner: string;
  threshold: bigint;
};

class RemoveOwnerEncoder<T extends RemoveOwnerArgs> {
  static readonly FUNCTION_SIGNATURE =
    'function removeOwner(address prevOwner, address owner, uint256 _threshold)';

  private constructor(private args: Partial<T>) {}

  public static new<T extends RemoveOwnerArgs>(): RemoveOwnerEncoder<T> {
    return new RemoveOwnerEncoder<T>({});
  }

  with<K extends keyof T>(key: K, value: T[K]) {
    const args: Partial<T> = { ...this.args, [key]: value };
    return new RemoveOwnerEncoder(args);
  }

  build(owners: Safe['owners']) {
    const prevOwner = (() => {
      const ownerIndex = owners.findIndex((owners) => {
        return getAddress(owners) === getAddress(this.args.owner!);
      });

      return ownerIndex <= 0
        ? SENTINEL_ADDRESS
        : getAddress(owners[ownerIndex - 1]);
    })();

    return {
      prevOwner,
      owner: getAddress(this.args.owner!),
      threshold: this.args.threshold!,
    };
  }

  encode(owners: Safe['owners']): Hex {
    const abi = parseAbi([RemoveOwnerEncoder.FUNCTION_SIGNATURE]);

    const { prevOwner, owner, threshold } = this.build(owners);

    return encodeFunctionData({
      abi,
      functionName: 'removeOwner',
      args: [prevOwner, owner, threshold],
    });
  }
}

export function removeOwnerEncoder() {
  return RemoveOwnerEncoder.new()
    .with('owner', faker.finance.ethereumAddress())
    .with('threshold', faker.number.bigInt({ min: 1, max: MAX_THRESHOLD }));
}

// swapOwner

type SwapOwnerArgs = {
  oldOwner: string;
  newOwner: string;
};

class SwapOwnerEncoder<T extends SwapOwnerArgs> {
  static readonly FUNCTION_SIGNATURE =
    'function swapOwner(address prevOwner, address oldOwner, address newOwner)';

  private constructor(private args: Partial<T>) {}

  public static new<T extends SwapOwnerArgs>(): SwapOwnerEncoder<T> {
    return new SwapOwnerEncoder<T>({});
  }

  with<K extends keyof T>(key: K, value: T[K]) {
    const args: Partial<T> = { ...this.args, [key]: value };
    return new SwapOwnerEncoder(args);
  }

  build(owners: Safe['owners']) {
    const prevOwner = (() => {
      const ownerIndex = owners.findIndex((owners) => {
        return getAddress(owners) === getAddress(this.args.oldOwner!);
      });

      return ownerIndex <= 0
        ? SENTINEL_ADDRESS
        : getAddress(owners[ownerIndex - 1]);
    })();

    return {
      prevOwner,
      oldOwner: getAddress(this.args.oldOwner!),
      newOwner: getAddress(this.args.newOwner!),
    };
  }

  encode(owners: Safe['owners']): Hex {
    const abi = parseAbi([SwapOwnerEncoder.FUNCTION_SIGNATURE]);

    const { prevOwner, oldOwner, newOwner } = this.build(owners);

    return encodeFunctionData({
      abi,
      functionName: 'swapOwner',
      args: [prevOwner, oldOwner, newOwner],
    });
  }
}

export function swapOwnerEncoder() {
  return SwapOwnerEncoder.new()
    .with('oldOwner', faker.finance.ethereumAddress())
    .with('newOwner', faker.finance.ethereumAddress());
}

// changeThreshold

type ChangeThresholdArgs = {
  threshold: bigint;
};

class ChangeThresholdEncoder<T extends ChangeThresholdArgs> {
  static readonly FUNCTION_SIGNATURE =
    'function changeThreshold(uint256 _threshold)';

  private constructor(private args: Partial<T>) {}

  public static new<
    T extends ChangeThresholdArgs,
  >(): ChangeThresholdEncoder<T> {
    return new ChangeThresholdEncoder<T>({});
  }

  with<K extends keyof T>(key: K, value: T[K]) {
    const args: Partial<T> = { ...this.args, [key]: value };
    return new ChangeThresholdEncoder(args);
  }

  build() {
    return {
      threshold: this.args.threshold!,
    };
  }

  encode(): Hex {
    const abi = parseAbi([ChangeThresholdEncoder.FUNCTION_SIGNATURE]);

    const { threshold } = this.build();

    return encodeFunctionData({
      abi,
      functionName: 'changeThreshold',
      args: [threshold],
    });
  }
}

export function changeThresholdEncoder() {
  return ChangeThresholdEncoder.new().with(
    'threshold',
    faker.number.bigInt({ min: 1, max: MAX_THRESHOLD }),
  );
}
