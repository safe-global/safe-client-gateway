import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { Server } from 'net';
import type { INestApplication } from '@nestjs/common';
import { TestAppProvider } from '@/__tests__/test-app.provider';
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
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';

describe('Positions Controller', () => {
  let app: INestApplication<Server>;
  let positionsRepository: jest.MockedObjectDeep<IPositionsRepository>;
  let chainsRepository: jest.MockedObjectDeep<IChainsRepository>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture = await Test.createTestingModule({
      imports: [ConfigurationModule.register(configuration)],
      controllers: [PositionsController],
      providers: [
        PositionsService,
        {
          provide: IPositionsRepository,
          useValue: { getPositions: jest.fn() },
        },
        { provide: IChainsRepository, useValue: { getChain: jest.fn() } },
      ],
    }).compile();

    positionsRepository = moduleFixture.get(IPositionsRepository);
    chainsRepository = moduleFixture.get(IChainsRepository);

    app = await new TestAppProvider().provide(moduleFixture);
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
        refresh: '',
      });
    });

    it('calls service with timestamp when refresh query parameter is true', async () => {
      const chain = chainBuilder().build();
      chainsRepository.getChain.mockResolvedValue(chain);

      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.finance.currencyCode();

      const applicationMetadata = zerionApplicationMetadataBuilder().build();
      const depositToken = balanceTokenBuilder().build();
      const depositTokenAddress = getAddress(faker.finance.ethereumAddress());

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
      ];

      positionsRepository.getPositions.mockResolvedValue(domainPositions);

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chain.chainId}/safes/${safeAddress}/positions/${fiatCode}?refresh=true`,
        )
        .expect(200);

      expect(positionsRepository.getPositions).toHaveBeenCalledWith({
        chain,
        chainId: chain.chainId,
        safeAddress,
        fiatCode,
        refresh: expect.stringMatching(/^\d+$/), // Expect a timestamp string
      });
    });

    it('calls service with empty string when refresh query parameter is false', async () => {
      const chain = chainBuilder().build();
      chainsRepository.getChain.mockResolvedValue(chain);

      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.finance.currencyCode();

      const applicationMetadata = zerionApplicationMetadataBuilder().build();
      const depositToken = balanceTokenBuilder().build();
      const depositTokenAddress = getAddress(faker.finance.ethereumAddress());

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
      ];

      positionsRepository.getPositions.mockResolvedValue(domainPositions);

      await request(app.getHttpServer())
        .get(
          `/v1/chains/${chain.chainId}/safes/${safeAddress}/positions/${fiatCode}?refresh=false`,
        )
        .expect(200);

      expect(positionsRepository.getPositions).toHaveBeenCalledWith({
        chain,
        chainId: chain.chainId,
        safeAddress,
        fiatCode,
        refresh: '', // Expect empty string when refresh is false
      });
    });
  });
});
