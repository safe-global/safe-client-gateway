import { PositionsService } from '@/routes/positions/positions.service';
import type { IPositionsRepository } from '@/domain/positions/positions.repository.interface';
import type { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { positionBuilder } from '@/domain/positions/entities/__tests__/position.builder';
import { PositionType } from '@/domain/positions/entities/position-type.entity';
import { faker } from '@faker-js/faker/.';
import { NULL_ADDRESS } from '@/routes/common/constants';
import type { Chain } from '@/domain/chains/entities/chain.entity';
import type { Address } from 'viem';

const positionsRepoMock = jest.mocked({
  getPositions: jest.fn(),
} as jest.MockedObjectDeep<IPositionsRepository>);

const chainsRepoMock = jest.mocked({
  getChain: jest.fn(),
} as jest.MockedObjectDeep<IChainsRepository>);

describe('PositionsService', () => {
  let service: PositionsService;

  beforeEach(() => {
    jest.resetAllMocks();

    service = new PositionsService(positionsRepoMock, chainsRepoMock);

    chainsRepoMock.getChain.mockResolvedValue({
      chainId: '1',
      nativeCurrency: {
        decimals: 18,
        symbol: 'ETH',
        name: 'Ether',
        logoUri: 'eth.png',
      },
    } as Chain);
  });

  it('groups by protocol/name/type, aggregates, and subtracts loans in protocol fiatTotal', async () => {
    const aaveDeposit = positionBuilder()
      .with('protocol', 'Aave')
      .with('name', 'USDC')
      .with('position_type', PositionType.deposit)
      .with('balance', '100')
      .with('fiatBalance', '100')
      .build();

    const aaveLoan = positionBuilder()
      .with('protocol', 'Aave')
      .with('name', 'USDC')
      .with('position_type', PositionType.loan)
      .with('balance', '40')
      .with('fiatBalance', '40')
      .build();

    const nativeDeposit = positionBuilder()
      .with('protocol', null)
      .with('name', 'ETH')
      .with('tokenAddress', null)
      .with('position_type', PositionType.deposit)
      .with('balance', '2')
      .with('fiatBalance', '6000')
      .with('fiatConversion', '3000')
      .build();

    positionsRepoMock.getPositions.mockResolvedValue([
      aaveDeposit,
      aaveLoan,
      nativeDeposit,
    ]);

    const res = await service.getPositions({
      chainId: '1',
      safeAddress: faker.finance.ethereumAddress() as Address,
      fiatCode: 'USD',
    });

    expect(res.map((p) => p.protocol).sort()).toEqual(['Aave', 'unknown']);

    const aave = res.find((p) => p.protocol === 'Aave')!;
    expect(aave).toEqual(
      expect.objectContaining({
        protocol: 'Aave',
        protocol_metadata: expect.anything(),
        fiatTotal: '60',
        items: expect.arrayContaining([
          expect.objectContaining({
            name: 'USDC',
            items: expect.arrayContaining([
              expect.objectContaining({
                position_type: PositionType.deposit,
                balance: '100',
                fiatBalance: '100',
                tokenInfo: expect.objectContaining({
                  type: 'ERC20',
                  address: expect.any(String),
                }),
              }),
              expect.objectContaining({
                position_type: PositionType.loan,
                balance: '40',
                fiatBalance: '40',
              }),
            ]),
          }),
        ]),
      }),
    );

    const unknown = res.find((p) => p.protocol === 'unknown')!;
    expect(unknown).toEqual(
      expect.objectContaining({
        protocol: 'unknown',
        fiatTotal: '6000',
        items: expect.arrayContaining([
          expect.objectContaining({
            name: 'ETH',
            items: expect.arrayContaining([
              expect.objectContaining({
                position_type: PositionType.deposit,
                tokenInfo: expect.objectContaining({
                  type: 'NATIVE_TOKEN',
                  symbol: 'ETH',
                  address: expect.any(String),
                }),
              }),
            ]),
          }),
        ]),
      }),
    );
  });

  it('returns individual positions without aggregation by type', async () => {
    const aaveDeposit1 = positionBuilder()
      .with('protocol', 'Aave')
      .with('name', 'USDC')
      .with('position_type', PositionType.deposit)
      .with('balance', '10')
      .with('fiatBalance', '30')
      .build();

    const aaveDeposit2 = positionBuilder()
      .with('protocol', 'Aave')
      .with('name', 'USDC')
      .with('position_type', PositionType.deposit)
      .with('balance', '5')
      .with('fiatBalance', '15')
      .build();

    positionsRepoMock.getPositions.mockResolvedValue([
      aaveDeposit1,
      aaveDeposit2,
    ]);

    const res = await service.getPositions({
      chainId: '1',
      safeAddress: faker.finance.ethereumAddress() as Address,
      fiatCode: 'USD',
    });

    const aave = res.find((p) => p.protocol === 'Aave')!;
    const usdcGroup = aave.items.find((g) => g.name === 'USDC')!;

    expect(usdcGroup.items).toHaveLength(2);
    expect(usdcGroup.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          position_type: PositionType.deposit,
          balance: '10',
          fiatBalance: '30',
        }),
        expect.objectContaining({
          position_type: PositionType.deposit,
          balance: '5',
          fiatBalance: '15',
        }),
      ]),
    );

    expect(aave.fiatTotal).toBe('45');
  });

  it('creates separate PositionGroups per name within a protocol', async () => {
    const position1 = positionBuilder()
      .with('protocol', 'Aave')
      .with('name', 'USDC')
      .with('position_type', PositionType.deposit)
      .with('fiatBalance', '10')
      .build();

    const position2 = positionBuilder()
      .with('protocol', 'Aave')
      .with('name', 'DAI')
      .with('position_type', PositionType.deposit)
      .with('fiatBalance', '20')
      .build();
    positionsRepoMock.getPositions.mockResolvedValue([position1, position2]);

    const [aave] = await service.getPositions({
      chainId: '1',
      safeAddress: faker.finance.ethereumAddress() as Address,
      fiatCode: 'USD',
    });

    expect(aave.protocol).toBe('Aave');
    expect(aave.items.map((g) => g.name).sort()).toEqual(['DAI', 'USDC']);
    expect(aave.fiatTotal).toBe('30');
  });

  it('subtracts loans in fiatTotal but does not negate balances', async () => {
    const deposit = positionBuilder()
      .with('protocol', 'Maker')
      .with('name', 'ETH')
      .with('position_type', PositionType.deposit)
      .with('balance', '2')
      .with('fiatBalance', '6000')
      .build();
    const loan = positionBuilder()
      .with('protocol', 'Maker')
      .with('name', 'ETH')
      .with('position_type', PositionType.loan)
      .with('balance', '1')
      .with('fiatBalance', '1500')
      .build();
    positionsRepoMock.getPositions.mockResolvedValue([deposit, loan]);

    const [maker] = await service.getPositions({
      chainId: '1',
      safeAddress: '0x1' as Address,
      fiatCode: 'USD',
    });

    const items = maker.items.find((g) => g.name === 'ETH')!.items;
    const loanItem = items.find((i) => i.position_type === PositionType.loan)!;
    expect(loanItem.balance).toBe('1');
    expect(maker.fiatTotal).toBe('4500');
  });

  it('maps native token with NULL_ADDRESS and NATIVE_TOKEN type', async () => {
    const native = positionBuilder()
      .with('protocol', null)
      .with('name', 'ETH')
      .with('tokenAddress', null)
      .with('position_type', PositionType.deposit)
      .with('balance', '1')
      .with('fiatBalance', '3000')
      .build();
    positionsRepoMock.getPositions.mockResolvedValue([native]);

    const [unknown] = await service.getPositions({
      chainId: '1',
      safeAddress: '0x1' as Address,
      fiatCode: 'USD',
    });

    const item = unknown.items[0].items[0];
    expect(item.tokenInfo).toEqual(
      expect.objectContaining({
        type: 'NATIVE_TOKEN',
        address: NULL_ADDRESS,
        symbol: 'ETH',
      }),
    );
    expect(unknown.fiatTotal).toBe('3000');
  });

  it('normalizes null fiat fields to "0" in mapped output', async () => {
    const position = positionBuilder()
      .with('fiatBalance', null)
      .with('fiatConversion', null)
      .with('position_type', PositionType.deposit)
      .build();
    positionsRepoMock.getPositions.mockResolvedValue([position]);

    const [protocol] = await service.getPositions({
      chainId: '1',
      safeAddress: '0x1' as Address,
      fiatCode: 'USD',
    });

    const item = protocol.items[0].items[0];
    expect(item.fiatBalance).toBe('0');
    expect(item.fiatConversion).toBe('0');
  });

  it('handles large numeric strings without aggregation', async () => {
    const big1 = positionBuilder()
      .with('protocol', 'Aave')
      .with('name', 'USDT')
      .with('position_type', PositionType.deposit)
      .with('balance', '1000000000000000')
      .with('fiatBalance', '2000000000000000')
      .build();
    const big2 = positionBuilder()
      .with('protocol', 'Aave')
      .with('name', 'USDT')
      .with('position_type', PositionType.deposit)
      .with('balance', '1')
      .with('fiatBalance', '2')
      .build();
    positionsRepoMock.getPositions.mockResolvedValue([big1, big2]);

    const [aave] = await service.getPositions({
      chainId: '1',
      safeAddress: '0x1' as Address,
      fiatCode: 'USD',
    });

    const usdtGroup = aave.items.find((g) => g.name === 'USDT')!;
    expect(usdtGroup.items).toHaveLength(2);
    expect(usdtGroup.items[0].balance).toBe('1000000000000000');
    expect(usdtGroup.items[0].fiatBalance).toBe('2000000000000000');
    expect(usdtGroup.items[1].balance).toBe('1');
    expect(usdtGroup.items[1].fiatBalance).toBe('2');
  });

  it('returns empty array when repository yields no positions', async () => {
    positionsRepoMock.getPositions.mockResolvedValue([]);
    const res = await service.getPositions({
      chainId: '1',
      safeAddress: faker.finance.ethereumAddress() as Address,
      fiatCode: 'USD',
    });
    expect(res).toEqual([]);
  });
});
