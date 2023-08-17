import { encodeFunctionData, parseAbi } from 'viem';
import { faker } from '@faker-js/faker';
import { AddressInfo } from '../../../common/entities/address-info.entity';
import { HumanDescriptionMapper } from './human-description.mapper';
import { TokenRepository } from '../../../../domain/tokens/token.repository';
import { tokenBuilder } from '../../../../domain/tokens/__tests__/token.builder';
import { ILoggingService } from '../../../../logging/logging.interface';

import Messages from '../../../../datasources/human-description-api/json';
import { HumanDescriptionApi } from '../../../../datasources/human-description-api/human-description-api.service';
import { MAX_UINT256 } from '../../constants';
import { SafeAppInfo } from '../../entities/safe-app-info.entity';

const tokenRepository = jest.mocked({
  getToken: jest.fn(),
} as unknown as TokenRepository);

const mockLoggingService = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
} as unknown as ILoggingService;

const humanDescriptionAPI = new HumanDescriptionApi(Messages);
const toAddress = new AddressInfo(faker.finance.ethereumAddress());
const chainId = faker.string.numeric();
const token = tokenBuilder()
  .with('decimals', 18)
  .with('name', 'Test Token')
  .with('symbol', 'TST')
  .build();
const abi = parseAbi(['function transfer(address, uint256)']);
const mockTransferData = encodeFunctionData({
  abi,
  functionName: 'transfer',
  args: [
    '0x7a9af6Ef9197041A5841e84cB27873bEBd3486E2',
    BigInt('21000000000000000000'),
  ],
});

describe('Human descriptions mapper (Unit)', () => {
  let mapper: HumanDescriptionMapper;

  beforeEach(() => {
    jest.clearAllMocks();

    mapper = new HumanDescriptionMapper(
      tokenRepository,
      mockLoggingService,
      humanDescriptionAPI,
    );
  });

  it('should return undefined if there is no data', async () => {
    const humanDescription = await mapper.mapHumanDescription(
      toAddress.value,
      null,
      chainId,
      null,
    );

    expect(humanDescription).toBeUndefined();
  });

  it('should return undefined if data is not hex data', async () => {
    const data = 'something that is not hex';

    const humanDescription = await mapper.mapHumanDescription(
      toAddress.value,
      data,
      chainId,
      null,
    );

    expect(humanDescription).toBeUndefined();
  });

  it('should return a human-readable description for erc20 transfers', async () => {
    tokenRepository.getToken.mockImplementation(() => Promise.resolve(token));

    const humanDescription = await mapper.mapHumanDescription(
      toAddress.value,
      mockTransferData,
      chainId,
      null,
    );

    expect(humanDescription).toBe('Send 21 TST to 0x7a9a...86E2');
  });

  it('should return undefined for corrupt data', async () => {
    tokenRepository.getToken.mockImplementation(() => Promise.resolve(token));

    const corruptedData = mockTransferData.slice(0, -7);

    const humanDescription = await mapper.mapHumanDescription(
      toAddress.value,
      corruptedData,
      chainId,
      null,
    );

    expect(humanDescription).toBeUndefined();
  });

  it('should return raw amount if token info cannot be fetched', async () => {
    tokenRepository.getToken.mockImplementation(() => {
      throw Error('No token info');
    });

    const humanDescription = await mapper.mapHumanDescription(
      toAddress.value,
      mockTransferData,
      chainId,
      null,
    );

    expect(humanDescription).toBe('Send 21000000000000000000 to 0x7a9a...86E2');
  });

  it('should return a description for unlimited token approvals', async () => {
    tokenRepository.getToken.mockImplementation(() => Promise.resolve(token));

    const mockApprovalData = encodeFunctionData({
      abi: parseAbi(['function approve(address, uint256)']),
      functionName: 'approve',
      args: ['0x7a9af6Ef9197041A5841e84cB27873bEBd3486E2', MAX_UINT256],
    });

    const humanDescription = await mapper.mapHumanDescription(
      toAddress.value,
      mockApprovalData,
      chainId,
      null,
    );

    expect(humanDescription).toBe('Approve unlimited TST to 0x7a9a...86E2');
  });

  it('should append the safe app name to the description if it exists', async () => {
    tokenRepository.getToken.mockImplementation(() => Promise.resolve(token));

    const mockSafeAppInfo = new SafeAppInfo(
      'CSV Airdrop',
      faker.internet.url(),
      faker.internet.avatar(),
    );

    const humanDescription = await mapper.mapHumanDescription(
      toAddress.value,
      mockTransferData,
      chainId,
      mockSafeAppInfo,
    );

    expect(humanDescription).toBe(
      'Send 21 TST to 0x7a9a...86E2 via CSV Airdrop',
    );
  });
});
