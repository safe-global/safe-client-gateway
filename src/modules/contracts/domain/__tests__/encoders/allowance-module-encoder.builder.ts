// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { Hex } from 'viem';
import { encodeFunctionData, getAddress } from 'viem';
import { Builder } from '@/__tests__/builder';
import type { IEncoder } from '@/__tests__/encoder-builder';
import { getAllowanceModuleAbi } from '@/domain/common/utils/deployments';

const AllowanceModuleAbi = getAllowanceModuleAbi();

// addDelegate

type AddDelegateArgs = {
  delegate: Hex;
};

class AddDelegateEncoder<T extends AddDelegateArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: AllowanceModuleAbi,
      functionName: 'addDelegate',
      args: [args.delegate],
    });
  }
}

export function addDelegateEncoder(): AddDelegateEncoder<AddDelegateArgs> {
  return new AddDelegateEncoder().with(
    'delegate',
    getAddress(faker.finance.ethereumAddress()),
  );
}

// removeDelegate

type RemoveDelegateArgs = {
  delegate: Hex;
  removeAllowances: boolean;
};

class RemoveDelegateEncoder<T extends RemoveDelegateArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: AllowanceModuleAbi,
      functionName: 'removeDelegate',
      args: [args.delegate, args.removeAllowances],
    });
  }
}

export function removeDelegateEncoder(): RemoveDelegateEncoder<RemoveDelegateArgs> {
  return new RemoveDelegateEncoder()
    .with('delegate', getAddress(faker.finance.ethereumAddress()))
    .with('removeAllowances', faker.datatype.boolean());
}

// setAllowance

type SetAllowanceArgs = {
  delegate: Hex;
  token: Hex;
  allowanceAmount: bigint;
  resetTimeMin: number;
  resetBaseMin: number;
};

class SetAllowanceEncoder<T extends SetAllowanceArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: AllowanceModuleAbi,
      functionName: 'setAllowance',
      args: [
        args.delegate,
        args.token,
        args.allowanceAmount,
        args.resetTimeMin,
        args.resetBaseMin,
      ],
    });
  }
}

export function setAllowanceEncoder(): SetAllowanceEncoder<SetAllowanceArgs> {
  return new SetAllowanceEncoder()
    .with('delegate', getAddress(faker.finance.ethereumAddress()))
    .with('token', getAddress(faker.finance.ethereumAddress()))
    .with('allowanceAmount', BigInt(faker.number.int({ min: 1, max: 1e9 })))
    .with('resetTimeMin', faker.number.int({ min: 0, max: 1e4 }))
    .with('resetBaseMin', faker.number.int({ min: 0, max: 1e4 }));
}

// resetAllowance

type ResetAllowanceArgs = {
  delegate: Hex;
  token: Hex;
};

class ResetAllowanceEncoder<T extends ResetAllowanceArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: AllowanceModuleAbi,
      functionName: 'resetAllowance',
      args: [args.delegate, args.token],
    });
  }
}

export function resetAllowanceEncoder(): ResetAllowanceEncoder<ResetAllowanceArgs> {
  return new ResetAllowanceEncoder()
    .with('delegate', getAddress(faker.finance.ethereumAddress()))
    .with('token', getAddress(faker.finance.ethereumAddress()));
}

// deleteAllowance

type DeleteAllowanceArgs = {
  delegate: Hex;
  token: Hex;
};

class DeleteAllowanceEncoder<T extends DeleteAllowanceArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: AllowanceModuleAbi,
      functionName: 'deleteAllowance',
      args: [args.delegate, args.token],
    });
  }
}

export function deleteAllowanceEncoder(): DeleteAllowanceEncoder<DeleteAllowanceArgs> {
  return new DeleteAllowanceEncoder()
    .with('delegate', getAddress(faker.finance.ethereumAddress()))
    .with('token', getAddress(faker.finance.ethereumAddress()));
}
