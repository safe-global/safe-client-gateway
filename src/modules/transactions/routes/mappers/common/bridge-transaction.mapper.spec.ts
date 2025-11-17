import { faker } from '@faker-js/faker';
import type { LiFiDecoder } from '@/domain/bridge/contracts/decoders/lifi-decoder.helper';
import type { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import type { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import type { IBridgeRepository } from '@/domain/bridge/bridge.repository.interface';
import type { BridgeStatus } from '@/domain/bridge/entities/bridge-status.entity';
import { BridgeTransactionMapper } from './bridge-transaction.mapper';
import { SwapTransactionInfo } from '@/modules/transactions/routes/entities/bridge/bridge-info.entity';
import { TokenInfo } from '@/modules/transactions/routes/entities/swaps/token-info.entity';
import type { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import type { Address, Hash, Hex } from 'viem';

describe('BridgeTransactionMapper (Unit)', () => {
  let mapper: BridgeTransactionMapper;
  let liFiDecoder: jest.Mocked<LiFiDecoder>;
  let tokenRepository: jest.Mocked<ITokenRepository>;
  let addressInfoHelper: jest.Mocked<AddressInfoHelper>;
  let bridgeRepository: jest.Mocked<IBridgeRepository>;
  let chainsRepository: jest.Mocked<IChainsRepository>;

  beforeEach(() => {
    liFiDecoder = {
      isBridge: jest.fn(),
      isSwap: jest.fn(),
      isSwapAndBridge: jest.fn(),
      decodeSwap: jest.fn(),
      decodeBridgeAndMaybeSwap: jest.fn(),
    } as unknown as jest.Mocked<LiFiDecoder>;

    tokenRepository = {
      getToken: jest.fn(),
      getTokens: jest.fn(),
    } as unknown as jest.Mocked<ITokenRepository>;

    addressInfoHelper = {
      get: jest.fn(),
      getOrDefault: jest.fn(),
      getCollection: jest.fn(),
    } as unknown as jest.Mocked<AddressInfoHelper>;

    bridgeRepository = {
      getDiamondAddress: jest.fn(),
      getStatus: jest.fn(),
      getQuote: jest.fn(),
      getRoutes: jest.fn(),
    } as unknown as jest.Mocked<IBridgeRepository>;

    chainsRepository = {
      getChain: jest.fn(),
    } as unknown as jest.Mocked<IChainsRepository>;

    mapper = new BridgeTransactionMapper(
      liFiDecoder,
      tokenRepository,
      addressInfoHelper,
      bridgeRepository,
      chainsRepository,
    );
  });

  describe('mapSwap', () => {
    it('should return a SwapTransactionInfo', async () => {
      const data = faker.string.hexadecimal({ length: 40 }) as Hex;
      const decoded = {
        transactionId: faker.string.hexadecimal({
          length: 64,
        }) as Hex,
        toAddress: faker.string.hexadecimal({ length: 40 }) as Address,
        fromToken: faker.string.hexadecimal({ length: 40 }) as Address,
        toToken: faker.string.hexadecimal({ length: 40 }) as Address,
        fromAmount: BigInt(1000000),
        toAmount: BigInt(1000000),
        fees: {
          tokenAddress: faker.finance.ethereumAddress() as Address,
          integratorFee: BigInt(100),
          lifiFee: BigInt(200),
          integratorAddress: faker.finance.ethereumAddress() as Address,
        },
      };
      liFiDecoder.decodeSwap.mockReturnValue(decoded);

      const result = await mapper.mapSwap({
        data,
        chainId: faker.string.numeric(),
        executionDate: null,
        safeAddress: faker.finance.ethereumAddress() as Address,
      });

      expect(result).toBeInstanceOf(SwapTransactionInfo);
      expect(liFiDecoder.decodeSwap).toHaveBeenCalledWith(data);
    });
  });

  describe('mapSwapAndBridge', () => {
    const chainId = faker.string.numeric();
    const data = faker.string.hexadecimal({ length: 40 }) as Hex;
    const safeAddress = faker.string.hexadecimal({
      length: 40,
    }) as Address;
    const fromToken = faker.string.hexadecimal({ length: 40 }) as Address;
    const toAddress = faker.string.hexadecimal({ length: 40 }) as Address;
    const toChain = BigInt(faker.number.int());

    it('should map a queued bridge transaction', async () => {
      const decoded = {
        transactionId: faker.string.hexadecimal({
          length: 64,
        }) as Hex,
        fromToken,
        toAddress,
        toChain,
        fromAmount: BigInt(1000000),
        toToken: faker.string.hexadecimal({ length: 40 }) as Address,
        minAmount: BigInt(1000000),
        fees: {
          tokenAddress: faker.string.hexadecimal({
            length: 40,
          }) as Address,
          integratorFee: BigInt(100),
          lifiFee: BigInt(200),
          integratorAddress: faker.string.hexadecimal({
            length: 40,
          }) as Address,
        },
        bridge: 'lifi',
      };
      liFiDecoder.decodeBridgeAndMaybeSwap.mockReturnValue(decoded);

      const tokenInfo = {
        address: fromToken,
        decimals: 18,
        logoUri: faker.image.url(),
        name: 'Test Token',
        symbol: 'TEST',
        trusted: true,
        type: 'ERC20' as const,
      };
      tokenRepository.getToken.mockResolvedValue(tokenInfo);

      const addressInfo = {
        value: toAddress,
        name: 'Test Address',
        logoUri: faker.image.url(),
      };
      addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);

      const result = await mapper.mapSwapAndBridge({
        chainId,
        data,
        executionDate: null,
        safeAddress,
      });

      expect(result).toEqual({
        fees: {
          integratorFee: decoded.fees.integratorFee.toString(),
          lifiFee: decoded.fees.lifiFee.toString(),
          tokenAddress: decoded.fees.tokenAddress,
        },
        fromToken: new TokenInfo(tokenInfo),
        humanDescription: null,
        recipient: addressInfo,
        fromAmount: decoded.fromAmount.toString(),
        toChain: decoded.toChain.toString(),
        status: 'AWAITING_EXECUTION',
        substatus: 'AWAITING_EXECUTION',
        toAmount: null,
        toToken: null,
        explorerUrl: null,
        type: 'SwapAndBridge',
      });
    });

    it('should map a historical bridge transaction with DONE status', async () => {
      const executionDate = new Date();
      const decoded = {
        transactionId: faker.string.hexadecimal({
          length: 64,
        }) as Hex,
        fromToken,
        toAddress,
        toChain,
        fromAmount: BigInt(1000000),
        toToken: faker.string.hexadecimal({ length: 40 }) as Address,
        minAmount: BigInt(1000000),
        fees: {
          tokenAddress: faker.string.hexadecimal({
            length: 40,
          }) as Address,
          integratorFee: BigInt(100),
          lifiFee: BigInt(200),
          integratorAddress: faker.string.hexadecimal({
            length: 40,
          }) as Address,
        },
        bridge: 'lifi',
      };
      liFiDecoder.decodeBridgeAndMaybeSwap.mockReturnValue(decoded);

      const tokenInfo = {
        address: fromToken,
        decimals: 18,
        logoUri: faker.image.url(),
        name: 'Test Token',
        symbol: 'TEST',
        trusted: true,
        type: 'ERC20' as const,
      };
      tokenRepository.getToken.mockResolvedValue(tokenInfo);

      const addressInfo = {
        value: toAddress,
        name: 'Test Address',
        logoUri: faker.image.url(),
      };
      addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);

      const bridgeStatus: BridgeStatus = {
        status: 'DONE',
        substatus: 'COMPLETED',
        substatusMessage: null,
        transactionId: decoded.transactionId,
        receiving: {
          value: '1000000',
          txHash: faker.string.hexadecimal({ length: 64 }) as Hash,
          chainId: decoded.toChain.toString(),
          txLink: faker.internet.url(),
          token: {
            address: decoded.toToken,
            decimals: 18,
            symbol: 'RECV',
            name: 'Received Token',
            chainId: decoded.toChain.toString(),
            coinKey: null,
            logoURI: faker.image.url(),
            priceUSD: '1',
          },
          amount: '1000000',
          gasPrice: '0',
          gasUsed: '0',
          gasToken: {
            address: faker.string.hexadecimal({ length: 40 }) as Address,
            decimals: 18,
            symbol: 'ETH',
            name: 'Ethereum',
            chainId: decoded.toChain.toString(),
            coinKey: null,
            logoURI: faker.image.url(),
            priceUSD: '1',
          },
          gasAmount: '0',
          timestamp: null,
        },
        lifiExplorerLink: faker.internet.url(),
        fromAddress: faker.string.hexadecimal({ length: 40 }) as Address,
        toAddress: faker.string.hexadecimal({ length: 40 }) as Address,
        metadata: {
          integrator: faker.string.alpha({ length: 10 }),
        },
        bridgeExplorerLink: null,
      };
      bridgeRepository.getStatus.mockResolvedValue(bridgeStatus);

      const result = await mapper.mapSwapAndBridge({
        chainId,
        data,
        executionDate,
        safeAddress,
      });

      expect(result).toEqual({
        fromToken: new TokenInfo(tokenInfo),
        recipient: addressInfo,
        fromAmount: decoded.fromAmount.toString(),
        toChain: decoded.toChain.toString(),
        status: 'DONE',
        substatus: 'COMPLETED',
        toAmount: bridgeStatus.receiving.amount,
        toToken: {
          address: decoded.toToken,
          decimals: 18,
          symbol: 'RECV',
          name: 'Received Token',
          logoUri: bridgeStatus.receiving.token?.logoURI,
          trusted: true,
        },
        explorerUrl: bridgeStatus.lifiExplorerLink,
        fees: {
          integratorFee: decoded.fees.integratorFee.toString(),
          lifiFee: decoded.fees.lifiFee.toString(),
          tokenAddress: decoded.fees.tokenAddress,
        },
        humanDescription: null,
        type: 'SwapAndBridge',
      });
    });

    it('should map a historical bridge transaction with FAILED status', async () => {
      const executionDate = new Date();
      const decoded = {
        transactionId: faker.string.hexadecimal({
          length: 64,
        }) as Hex,
        fromToken,
        toAddress,
        toChain,
        fromAmount: BigInt(1000000),
        toToken: faker.string.hexadecimal({ length: 40 }) as Address,
        minAmount: BigInt(1000000),
        fees: {
          tokenAddress: faker.string.hexadecimal({
            length: 40,
          }) as Address,
          integratorFee: BigInt(100),
          lifiFee: BigInt(200),
          integratorAddress: faker.string.hexadecimal({
            length: 40,
          }) as Address,
        },
        bridge: 'lifi',
      };
      liFiDecoder.decodeBridgeAndMaybeSwap.mockReturnValue(decoded);

      const tokenInfo = {
        address: fromToken,
        decimals: 18,
        logoUri: faker.image.url(),
        name: 'Test Token',
        symbol: 'TEST',
        trusted: true,
        type: 'ERC20' as const,
      };
      tokenRepository.getToken.mockResolvedValue(tokenInfo);

      const addressInfo = {
        value: toAddress,
        name: 'Test Address',
        logoUri: faker.image.url(),
      };
      addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);

      const bridgeStatus: BridgeStatus = {
        status: 'FAILED',
        substatus: 'UNKNOWN_FAILED_ERROR',
        substatusMessage: 'Transaction failed',
        sending: {
          txHash: faker.string.hexadecimal({ length: 64 }) as Hash,
          chainId,
          txLink: faker.internet.url(),
        },
      };
      bridgeRepository.getStatus.mockResolvedValue(bridgeStatus);

      const result = await mapper.mapSwapAndBridge({
        chainId,
        data,
        executionDate,
        safeAddress,
      });

      expect(result).toEqual({
        fromToken: new TokenInfo(tokenInfo),
        recipient: addressInfo,
        fromAmount: decoded.fromAmount.toString(),
        toChain: decoded.toChain.toString(),
        status: 'FAILED',
        substatus: 'UNKNOWN_FAILED_ERROR',
        toAmount: null,
        toToken: null,
        explorerUrl: null,
        fees: {
          integratorFee: decoded.fees.integratorFee.toString(),
          lifiFee: decoded.fees.lifiFee.toString(),
          tokenAddress: decoded.fees.tokenAddress,
        },
        humanDescription: null,
        type: 'SwapAndBridge',
      });
    });

    it('should map a historical bridge transaction with PENDING status', async () => {
      const executionDate = new Date();
      const decoded = {
        transactionId: faker.string.hexadecimal({
          length: 64,
        }) as Hex,
        fromToken,
        toAddress,
        toChain,
        fromAmount: BigInt(1000000),
        toToken: faker.string.hexadecimal({ length: 40 }) as Address,
        minAmount: BigInt(1000000),
        fees: null,
        bridge: 'lifi',
      };
      liFiDecoder.decodeBridgeAndMaybeSwap.mockReturnValue(decoded);

      const tokenInfo = {
        address: fromToken,
        decimals: 18,
        logoUri: faker.image.url(),
        name: 'Test Token',
        symbol: 'TEST',
        trusted: true,
        type: 'ERC20' as const,
      };
      tokenRepository.getToken.mockResolvedValue(tokenInfo);

      const addressInfo = {
        value: toAddress,
        name: 'Test Address',
        logoUri: faker.image.url(),
      };
      addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);

      const bridgeStatus: BridgeStatus = {
        status: 'PENDING',
        substatus: 'WAIT_SOURCE_CONFIRMATIONS',
        substatusMessage: 'Waiting for source confirmations',
      };
      bridgeRepository.getStatus.mockResolvedValue(bridgeStatus);

      const result = await mapper.mapSwapAndBridge({
        chainId,
        data,
        executionDate,
        safeAddress,
      });

      expect(result).toEqual({
        fromToken: new TokenInfo(tokenInfo),
        recipient: addressInfo,
        fromAmount: decoded.fromAmount.toString(),
        toChain: decoded.toChain.toString(),
        status: 'PENDING',
        substatus: 'WAIT_SOURCE_CONFIRMATIONS',
        toAmount: null,
        toToken: null,
        explorerUrl: null,
        fees: null,
        humanDescription: null,
        type: 'SwapAndBridge',
      });
    });
  });
});
