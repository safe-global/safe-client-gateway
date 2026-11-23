// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import {
  type Address,
  encodeAbiParameters,
  erc20Abi,
  getAbiItem,
  getAddress,
  pad,
  toEventSelector,
  toHex,
} from 'viem';
import { Builder } from '#/__tests__/builder';
import type { IEncoder } from '#/__tests__/encoder-builder';
import type { ApprovalLog } from '#/modules/token-approvals/domain/entities/approval-log.entity';

const APPROVAL_TOPIC = toEventSelector(
  getAbiItem({ abi: erc20Abi, name: 'Approval' }),
);

// ERC-20: Approval(address indexed owner, address indexed spender, uint256 value)

type Erc20ApprovalLogArgs = {
  tokenAddress: Address;
  owner: Address;
  spender: Address;
  value: bigint;
};

class Erc20ApprovalLogEncoder<T extends Erc20ApprovalLogArgs>
  extends Builder<T>
  implements IEncoder<ApprovalLog>
{
  encode(): ApprovalLog {
    const args = this.build();

    return {
      address: args.tokenAddress,
      topics: [APPROVAL_TOPIC, pad(args.owner), pad(args.spender)],
      data: encodeAbiParameters([{ type: 'uint256' }], [args.value]),
    };
  }
}

export function erc20ApprovalLogEncoder(): Erc20ApprovalLogEncoder<Erc20ApprovalLogArgs> {
  return new Erc20ApprovalLogEncoder()
    .with('tokenAddress', getAddress(faker.finance.ethereumAddress()))
    .with('owner', getAddress(faker.finance.ethereumAddress()))
    .with('spender', getAddress(faker.finance.ethereumAddress()))
    .with('value', faker.number.bigInt());
}

// ERC-721: Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)

type Erc721ApprovalLogArgs = {
  tokenAddress: Address;
  owner: Address;
  approved: Address;
  tokenId: bigint;
};

class Erc721ApprovalLogEncoder<T extends Erc721ApprovalLogArgs>
  extends Builder<T>
  implements IEncoder<ApprovalLog>
{
  encode(): ApprovalLog {
    const args = this.build();

    return {
      address: args.tokenAddress,
      topics: [
        APPROVAL_TOPIC,
        pad(args.owner),
        pad(args.approved),
        pad(toHex(args.tokenId)),
      ],
      data: '0x',
    };
  }
}

export function erc721ApprovalLogEncoder(): Erc721ApprovalLogEncoder<Erc721ApprovalLogArgs> {
  return new Erc721ApprovalLogEncoder()
    .with('tokenAddress', getAddress(faker.finance.ethereumAddress()))
    .with('owner', getAddress(faker.finance.ethereumAddress()))
    .with('approved', getAddress(faker.finance.ethereumAddress()))
    .with('tokenId', faker.number.bigInt());
}
