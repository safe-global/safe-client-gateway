import { faker } from '@faker-js/faker';
import { parseAbi, encodeFunctionData, getAddress, Hex } from 'viem';

export function addOwnerWithThresholdEncoder(
  {
    owner = faker.finance.ethereumAddress(),
    _threshold = faker.number.bigInt(),
  }: {
    owner: string;
    _threshold: bigint;
  } = {
    owner: faker.finance.ethereumAddress(),
    _threshold: faker.number.bigInt(),
  },
): Hex {
  const abi = parseAbi([
    'function addOwnerWithThreshold(address owner, uint256 _threshold)',
  ]);

  return encodeFunctionData({
    abi,
    functionName: 'addOwnerWithThreshold',
    args: [getAddress(owner), _threshold],
  });
}

export function removeOwnerEncoder(
  {
    prevOwner = faker.finance.ethereumAddress(),
    owner = faker.finance.ethereumAddress(),
    _threshold = faker.number.bigInt(),
  }: {
    prevOwner: string;
    owner: string;
    _threshold: bigint;
  } = {
    prevOwner: faker.finance.ethereumAddress(),
    owner: faker.finance.ethereumAddress(),
    _threshold: faker.number.bigInt(),
  },
): Hex {
  const ABI = parseAbi([
    'function removeOwner(address prevOwner, address owner, uint256 _threshold)',
  ]);

  return encodeFunctionData({
    abi: ABI,
    functionName: 'removeOwner',
    args: [getAddress(prevOwner), getAddress(owner), _threshold],
  });
}

export function swapOwnerEncoder(
  {
    prevOwner = faker.finance.ethereumAddress(),
    oldOwner = faker.finance.ethereumAddress(),
    newOwner = faker.finance.ethereumAddress(),
  }: {
    prevOwner: string;
    oldOwner: string;
    newOwner: string;
  } = {
    prevOwner: faker.finance.ethereumAddress(),
    oldOwner: faker.finance.ethereumAddress(),
    newOwner: faker.finance.ethereumAddress(),
  },
): Hex {
  const ABI = parseAbi([
    'function swapOwner(address prevOwner, address oldOwner, address newOwner)',
  ]);

  return encodeFunctionData({
    abi: ABI,
    functionName: 'swapOwner',
    args: [getAddress(prevOwner), getAddress(oldOwner), getAddress(newOwner)],
  });
}

export function changeThresholdEncoder(
  {
    _threshold = faker.number.bigInt(),
  }: {
    _threshold: bigint;
  } = {
    _threshold: faker.number.bigInt(),
  },
): Hex {
  const ABI = parseAbi(['function changeThreshold(uint256 _threshold)']);

  return encodeFunctionData({
    abi: ABI,
    functionName: 'changeThreshold',
    args: [_threshold],
  });
}
