import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { Server } from 'net';
import type { INestApplication } from '@nestjs/common';
import { VersioningType } from '@nestjs/common';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { IPositionsRepository } from '@/domain/positions/positions.repository.interface';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { positionBuilder } from '@/domain/positions/entities/__tests__/position.builder';
import { balanceTokenBuilder } from '@/domain/balances/entities/__tests__/balance.token.builder';
import { PositionType } from '@/domain/positions/entities/position-type.entity';
import { zerionApplicationMetadataBuilder } from '@/datasources/balances-api/entities/__tests__/zerion-balance.entity.builder';
import { PositionsService } from '@/routes/positions/positions.service';
import { PositionsController } from '@/routes/positions/positions.controller';

jest.mock('@/domain/common/utils/utils', () => ({
  getNumberString: (value: number): string => value.toString(),
}));

describe('Positions Controller', () => {
  let app: INestApplication<Server>;
  let positionsRepository: jest.MockedObjectDeep<IPositionsRepository>;
  let chainsRepository: jest.MockedObjectDeep<IChainsRepository>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleBuilder = Test.createTestingModule({
      controllers: [PositionsController],
      providers: [
        PositionsService,
        {
          provide: IPositionsRepository,
          useValue: { getPositions: jest.fn() },
        },
        { provide: IChainsRepository, useValue: { getChain: jest.fn() } },
      ],
    });

    const moduleFixture = await moduleBuilder.compile();

    positionsRepository = moduleFixture.get(IPositionsRepository);
    chainsRepository = moduleFixture.get(IChainsRepository);

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /positions', () => {
    it('maps and aggregates positions by protocol and name', async () => {
      const chain = chainBuilder().build();
      chainsRepository.getChain.mockResolvedValue(chain);

      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.finance.currencyCode();

      const applicationMetadata = zerionApplicationMetadataBuilder().build();
      const depositToken = balanceTokenBuilder().build();
      const depositTokenAddress = getAddress(faker.finance.ethereumAddress());
      const loanToken = balanceTokenBuilder().build();
      const loanTokenAddress = getAddress(faker.finance.ethereumAddress());

      const domainPositions = [
        positionBuilder()
          .with('protocol', 'aave')
          .with('name', 'Aave V3')
          .with('position_type', PositionType.deposit)
          .with('tokenAddress', depositTokenAddress)
          .with('token', depositToken)
          .with('balance', '2')
          .with('fiatBalance', '50')
          .with('fiatConversion', '25')
          .with('fiatBalance24hChange', '1')
          .with('application_metadata', applicationMetadata)
          .build(),
        positionBuilder()
          .with('protocol', 'aave')
          .with('name', 'Aave V3')
          .with('position_type', PositionType.deposit)
          .with('tokenAddress', depositTokenAddress)
          .with('token', depositToken)
          .with('balance', '3')
          .with('fiatBalance', '75')
          .with('fiatConversion', '25')
          .with('fiatBalance24hChange', '1')
          .with('application_metadata', applicationMetadata)
          .build(),
        positionBuilder()
          .with('protocol', 'aave')
          .with('name', 'Aave V3')
          .with('position_type', PositionType.loan)
          .with('tokenAddress', loanTokenAddress)
          .with('token', loanToken)
          .with('balance', '1')
          .with('fiatBalance', '20')
          .with('fiatConversion', '20')
          .with('fiatBalance24hChange', '0.5')
          .with('application_metadata', applicationMetadata)
          .build(),
      ];

      positionsRepository.getPositions.mockResolvedValue(domainPositions);

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chain.chainId}/safes/${safeAddress}/positions/${fiatCode}`,
        )
        .expect(200)
        .expect([
          {
            protocol: 'aave',
            protocol_metadata: applicationMetadata,
            fiatTotal: '105',
            items: [
              {
                name: 'Aave V3',
                items: [
                  {
                    position_type: PositionType.deposit,
                    tokenInfo: {
                      type: 'ERC20',
                      address: depositTokenAddress,
                      decimals: depositToken.decimals,
                      symbol: depositToken.symbol,
                      name: depositToken.name,
                      logoUri: depositToken.logoUri,
                    },
                    balance: '5',
                    fiatBalance: '125',
                    fiatBalance24hChange: '1',
                    fiatConversion: '25',
                  },
                  {
                    position_type: PositionType.loan,
                    tokenInfo: {
                      type: 'ERC20',
                      address: loanTokenAddress,
                      decimals: loanToken.decimals,
                      symbol: loanToken.symbol,
                      name: loanToken.name,
                      logoUri: loanToken.logoUri,
                    },
                    balance: '1',
                    fiatBalance: '20',
                    fiatBalance24hChange: '0.5',
                    fiatConversion: '20',
                  },
                ],
              },
            ],
          },
        ]);

      expect(chainsRepository.getChain).toHaveBeenCalledWith(chain.chainId);
      expect(positionsRepository.getPositions).toHaveBeenCalledWith({
        chain,
        chainId: chain.chainId,
        safeAddress,
        fiatCode,
      });
    });
  });
});
