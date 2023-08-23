import { encodeFunctionData, formatUnits, parseAbi } from 'viem';
import { faker } from '@faker-js/faker';
import { AddressInfo } from '../../../common/entities/address-info.entity';
import { HumanDescriptionMapper } from './human-description.mapper';
import { TokenRepository } from '../../../../domain/tokens/token.repository';
import { tokenBuilder } from '../../../../domain/tokens/__tests__/token.builder';
import { ILoggingService } from '../../../../logging/logging.interface';

import { HumanDescriptionApi } from '../../../../datasources/human-description-api/human-description-api.service';
import { MAX_UINT256 } from '../../constants';
import { SafeAppInfo } from '../../entities/safe-app-info.entity';
import { HumanDescriptionRepository } from '../../../../domain/human-description/human-description.repository';
import { multisigTransactionBuilder } from '../../../../domain/safe/entities/__tests__/multisig-transaction.builder';
import { SafeAppInfoMapper } from './safe-app-info.mapper';

const tokenRepository = jest.mocked({
  getToken: jest.fn(),
} as unknown as TokenRepository);

const mockLoggingService = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
} as unknown as ILoggingService;

const safeAppInfoMapper = jest.mocked({
  mapSafeAppInfo: jest.fn(),
} as unknown as SafeAppInfoMapper);

const humanDescriptionAPI = new HumanDescriptionApi();
const humanDescriptionRepository = new HumanDescriptionRepository(
  humanDescriptionAPI,
);
const toAddress = new AddressInfo(faker.finance.ethereumAddress());
const chainId = faker.string.numeric();
const token = tokenBuilder()
  .with('decimals', 18)
  .with('name', 'Test Token')
  .with('symbol', 'TST')
  .build();
const abi = parseAbi(['function transfer(address, uint256)']);
const mockAmount = faker.number.bigInt();
const mockTransferData = encodeFunctionData({
  abi,
  functionName: 'transfer',
  args: ['0x7a9af6Ef9197041A5841e84cB27873bEBd3486E2', mockAmount],
});

const transaction = multisigTransactionBuilder()
  .with('to', toAddress.value)
  .with('data', mockTransferData)
  .build();

describe('Human descriptions mapper (Unit)', () => {
  let mapper: HumanDescriptionMapper;

  beforeEach(() => {
    jest.clearAllMocks();

    mapper = new HumanDescriptionMapper(
      tokenRepository,
      mockLoggingService,
      humanDescriptionRepository,
      safeAppInfoMapper,
    );
  });

  it('should return null if there is no data', async () => {
    const transaction = multisigTransactionBuilder().with('data', null).build();

    const humanDescription = await mapper.mapHumanDescription(
      transaction,
      chainId,
    );

    expect(humanDescription).toBeNull();
  });

  it('should return null if data is not hex data', async () => {
    const data = 'something that is not hex';

    const transaction = multisigTransactionBuilder().with('data', data).build();

    const humanDescription = await mapper.mapHumanDescription(
      transaction,
      chainId,
    );

    expect(humanDescription).toBeNull();
  });

  it('should return a human-readable description for erc20 transfers', async () => {
    tokenRepository.getToken.mockImplementation(() => Promise.resolve(token));

    const humanDescription = await mapper.mapHumanDescription(
      transaction,
      chainId,
    );

    expect(humanDescription).toBe(
      `Send ${formatUnits(mockAmount, token.decimals!)} TST to 0x7a9a...86E2`,
    );
  });

  it('should return null for corrupt data', async () => {
    tokenRepository.getToken.mockImplementation(() => Promise.resolve(token));

    const corruptedData = mockTransferData.slice(0, -7);

    const transaction = multisigTransactionBuilder()
      .with('data', corruptedData)
      .build();

    const humanDescription = await mapper.mapHumanDescription(
      transaction,
      chainId,
    );

    expect(humanDescription).toBeNull();
  });

  it('should return raw amount if token info cannot be fetched', async () => {
    tokenRepository.getToken.mockImplementation(() => {
      throw Error('No token info');
    });

    const humanDescription = await mapper.mapHumanDescription(
      transaction,
      chainId,
    );

    expect(humanDescription).toBe(`Send ${mockAmount} to 0x7a9a...86E2`);
  });

  it('should return a description for unlimited token approvals', async () => {
    tokenRepository.getToken.mockImplementation(() => Promise.resolve(token));

    const mockApprovalData = encodeFunctionData({
      abi: parseAbi(['function approve(address, uint256)']),
      functionName: 'approve',
      args: ['0x7a9af6Ef9197041A5841e84cB27873bEBd3486E2', MAX_UINT256],
    });

    const transaction = multisigTransactionBuilder()
      .with('data', mockApprovalData)
      .build();

    const humanDescription = await mapper.mapHumanDescription(
      transaction,
      chainId,
    );

    expect(humanDescription).toBe('Approve unlimited TST');
  });

  it('should append the safe app name to the description if it exists', async () => {
    tokenRepository.getToken.mockImplementation(() => Promise.resolve(token));
    const mockSafeAppInfo = new SafeAppInfo(
      'CSV Airdrop',
      faker.internet.url(),
      faker.internet.avatar(),
    );
    safeAppInfoMapper.mapSafeAppInfo.mockImplementation(() =>
      Promise.resolve(mockSafeAppInfo),
    );

    const humanDescription = await mapper.mapHumanDescription(
      transaction,
      chainId,
    );

    expect(humanDescription).toBe(
      `Send ${formatUnits(
        mockAmount,
        token.decimals!,
      )} TST to 0x7a9a...86E2 via CSV Airdrop`,
    );
  });
});
