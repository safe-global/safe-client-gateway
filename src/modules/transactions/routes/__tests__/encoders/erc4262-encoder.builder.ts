// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, encodeFunctionData, erc4626Abi, getAddress } from 'viem';
import { Builder } from '#/__tests__/builder';
import type { IEncoder } from '#/__tests__/encoder-builder';
import type { Erc4626VaultMethod } from '#/modules/transactions/domain/entities/erc4626-vault.entity';
import { erc4626ReferralAbi } from '#/modules/transactions/routes/decoders/erc4626-vault.abi';

// deposit

type Erc4262DepositArgs = {
  assets: bigint;
  receiver: Address;
};

class Erc4262DepositEncoder<T extends Erc4262DepositArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Address {
    const args = this.build();

    return encodeFunctionData({
      abi: erc4626Abi,
      functionName: 'deposit',
      args: [args.assets, args.receiver],
    });
  }
}

export function erc4262DepositEncoder(): Erc4262DepositEncoder<Erc4262DepositArgs> {
  return new Erc4262DepositEncoder()
    .with('assets', faker.number.bigInt())
    .with('receiver', getAddress(faker.finance.ethereumAddress()));
}

// withdraw

type Erc4262WithdrawArgs = {
  assets: bigint;
  receiver: Address;
  owner: Address;
};

class Erc4262WithdrawEncoder<T extends Erc4262WithdrawArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Address {
    const args = this.build();

    return encodeFunctionData({
      abi: erc4626Abi,
      functionName: 'withdraw',
      args: [args.assets, args.receiver, args.owner],
    });
  }
}

export function erc4262WithdrawEncoder(): Erc4262WithdrawEncoder<Erc4262WithdrawArgs> {
  return new Erc4262WithdrawEncoder()
    .with('assets', faker.number.bigInt())
    .with('receiver', getAddress(faker.finance.ethereumAddress()))
    .with('owner', getAddress(faker.finance.ethereumAddress()));
}

// redeem

type Erc4262RedeemArgs = {
  shares: bigint;
  receiver: Address;
  owner: Address;
};

class Erc4262RedeemEncoder<T extends Erc4262RedeemArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Address {
    const args = this.build();

    return encodeFunctionData({
      abi: erc4626Abi,
      functionName: 'redeem',
      args: [args.shares, args.receiver, args.owner],
    });
  }
}

export function erc4262RedeemEncoder(): Erc4262RedeemEncoder<Erc4262RedeemArgs> {
  return new Erc4262RedeemEncoder()
    .with('shares', faker.number.bigInt())
    .with('receiver', getAddress(faker.finance.ethereumAddress()))
    .with('owner', getAddress(faker.finance.ethereumAddress()));
}

// deposit/mint with uint16 referral (non-standard overloads)

type ReferralMethod = Extract<Erc4626VaultMethod, 'deposit' | 'mint'>;

type Erc4626ReferralArgs = {
  amount: bigint;
  receiver: Address;
  referral: number;
};

class Erc4626ReferralEncoder<T extends Erc4626ReferralArgs>
  extends Builder<T>
  implements IEncoder
{
  constructor(private readonly functionName: ReferralMethod) {
    super();
  }

  encode(): Address {
    const args = this.build();

    return encodeFunctionData({
      abi: erc4626ReferralAbi,
      functionName: this.functionName,
      args: [args.amount, args.receiver, args.referral],
    });
  }
}

function erc4626ReferralEncoder(
  functionName: ReferralMethod,
): Erc4626ReferralEncoder<Erc4626ReferralArgs> {
  return new Erc4626ReferralEncoder(functionName)
    .with('amount', faker.number.bigInt())
    .with('receiver', getAddress(faker.finance.ethereumAddress()))
    .with('referral', faker.number.int({ min: 0, max: 65_535 }));
}

export function erc4626ReferralDepositEncoder(): Erc4626ReferralEncoder<Erc4626ReferralArgs> {
  return erc4626ReferralEncoder('deposit');
}

export function erc4626ReferralMintEncoder(): Erc4626ReferralEncoder<Erc4626ReferralArgs> {
  return erc4626ReferralEncoder('mint');
}
