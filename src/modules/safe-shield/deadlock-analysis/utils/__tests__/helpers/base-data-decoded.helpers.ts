// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';
import type { BaseDataDecoded } from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';

export function addr(): Address {
  return getAddress(faker.finance.ethereumAddress());
}

export function addOwnerDecoded(
  owner: Address,
  threshold: number,
): BaseDataDecoded {
  return {
    method: 'addOwnerWithThreshold',
    parameters: [
      { name: 'owner', type: 'address', value: owner },
      { name: '_threshold', type: 'uint256', value: String(threshold) },
    ],
  } as BaseDataDecoded;
}

export function removeOwnerDecoded(
  owner: Address,
  threshold: number,
): BaseDataDecoded {
  return {
    method: 'removeOwner',
    parameters: [
      { name: 'prevOwner', type: 'address', value: addr() },
      { name: 'owner', type: 'address', value: owner },
      { name: '_threshold', type: 'uint256', value: String(threshold) },
    ],
  } as BaseDataDecoded;
}

export function swapOwnerDecoded(
  oldOwner: Address,
  newOwner: Address,
): BaseDataDecoded {
  return {
    method: 'swapOwner',
    parameters: [
      { name: 'prevOwner', type: 'address', value: addr() },
      { name: 'oldOwner', type: 'address', value: oldOwner },
      { name: 'newOwner', type: 'address', value: newOwner },
    ],
  } as BaseDataDecoded;
}

export function changeThresholdDecoded(threshold: number): BaseDataDecoded {
  return {
    method: 'changeThreshold',
    parameters: [
      { name: '_threshold', type: 'uint256', value: String(threshold) },
    ],
  } as BaseDataDecoded;
}
