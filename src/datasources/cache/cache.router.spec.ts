// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { CacheRouter } from '@/datasources/cache/cache.router';
import type { BaseDataDecoded } from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';

const address = getAddress(faker.finance.ethereumAddress());

describe('CacheRouter', () => {
  describe('portfolio cache keys', () => {
    it('should use distinct keys for positions and wallet portfolio endpoints', () => {
      const portfolioDir = CacheRouter.getPortfolioCacheDir({
        address,
        fiatCode: 'USD',
      });
      const walletPortfolioDir = CacheRouter.getZerionWalletPortfolioCacheDir({
        address,
        fiatCode: 'USD',
      });

      expect(portfolioDir.key).toBe(`portfolio_${address}_zerion`);
      expect(walletPortfolioDir.key).toBe(`zerion_wallet_portfolio_${address}`);
      expect(portfolioDir.key).not.toBe(walletPortfolioDir.key);
    });

    it('should produce correct cache dir for positions endpoint', () => {
      const dir = CacheRouter.getPortfolioCacheDir({
        address,
        fiatCode: 'USD',
        trusted: true,
        isTestnet: false,
      });

      expect(dir.key).toBe(`portfolio_${address}_zerion`);
      expect(dir.field).toBe('usd_trusted');
    });

    it('should produce correct cache dir for wallet portfolio endpoint', () => {
      const dir = CacheRouter.getZerionWalletPortfolioCacheDir({
        address,
        fiatCode: 'EUR',
        trusted: false,
        isTestnet: true,
      });

      expect(dir.key).toBe(`zerion_wallet_portfolio_${address}`);
      expect(dir.field).toBe('eur_testnet');
    });

    it('should normalize fiatCode to lowercase for cache key consistency', () => {
      const dirLower = CacheRouter.getPortfolioCacheDir({
        address,
        fiatCode: 'usd',
      });
      const dirUpper = CacheRouter.getPortfolioCacheDir({
        address,
        fiatCode: 'USD',
      });

      expect(dirLower.key).toBe(dirUpper.key);
      expect(dirLower.field).toBe(dirUpper.field);
      expect(dirLower.field).toBe('usd');
    });
  });

  describe('deadlock analysis cache keys', () => {
    const chainId = '1';
    const safeAddress = getAddress(faker.finance.ethereumAddress());

    const addOwnerDecoded: BaseDataDecoded = {
      method: 'addOwnerWithThreshold',
      parameters: [
        { name: 'owner', type: 'address', value: address },
        { name: '_threshold', type: 'uint256', value: '1' },
      ],
    } as BaseDataDecoded;

    const changeThresholdDecoded: BaseDataDecoded = {
      method: 'changeThreshold',
      parameters: [{ name: '_threshold', type: 'uint256', value: '2' }],
    } as BaseDataDecoded;

    it('should accept an array with a single item', () => {
      const dir = CacheRouter.getDeadlockAnalysisCacheDir({
        chainId,
        safeAddress,
        dataDecoded: [addOwnerDecoded],
      });

      expect(dir.key).toBe(`${chainId}_deadlock_analysis_${safeAddress}`);
      expect(dir.field).toEqual(expect.any(String));
      expect(dir.field.length).toBe(64); // sha256 hex
    });

    it('should produce different hashes for different orderings', () => {
      const dir1 = CacheRouter.getDeadlockAnalysisCacheDir({
        chainId,
        safeAddress,
        dataDecoded: [addOwnerDecoded, changeThresholdDecoded],
      });
      const dir2 = CacheRouter.getDeadlockAnalysisCacheDir({
        chainId,
        safeAddress,
        dataDecoded: [changeThresholdDecoded, addOwnerDecoded],
      });

      expect(dir1.key).toBe(dir2.key);
      expect(dir1.field).not.toBe(dir2.field);
    });

    it('should produce different hashes for single vs multiple items', () => {
      const dirSingle = CacheRouter.getDeadlockAnalysisCacheDir({
        chainId,
        safeAddress,
        dataDecoded: [addOwnerDecoded],
      });
      const dirMulti = CacheRouter.getDeadlockAnalysisCacheDir({
        chainId,
        safeAddress,
        dataDecoded: [addOwnerDecoded, changeThresholdDecoded],
      });

      expect(dirSingle.field).not.toBe(dirMulti.field);
    });
  });

  describe('getQueueMultisigTransactionCacheDir', () => {
    const chainId = '1';
    const safeTransactionHash = faker.string.hexadecimal({ length: 64 });

    it('Should produce a key under the queue_multisig_transaction namespace, distinct from the tx-service key', () => {
      const queueDir = CacheRouter.getQueueMultisigTransactionCacheDir({
        chainId,
        safeTransactionHash,
      });
      const txDir = CacheRouter.getMultisigTransactionCacheDir({
        chainId,
        safeTransactionHash,
      });

      expect(queueDir.key).not.toBe(txDir.key);
      expect(queueDir.key).toBe(
        `${chainId}_queue_multisig_transaction_${safeTransactionHash}`,
      );
    });
  });

  describe('getQueueMultisigTransactionsCacheKey', () => {
    const chainId = '1';
    const safeAddress = getAddress(faker.finance.ethereumAddress());

    it('Should produce a key under the queue_multisig_transactions namespace, distinct from the tx-service key', () => {
      const queueListKey = CacheRouter.getQueueMultisigTransactionsCacheKey({
        chainId,
        safeAddress,
      });
      const txListKey = CacheRouter.getMultisigTransactionsCacheKey({
        chainId,
        safeAddress,
      });

      expect(queueListKey).not.toBe(txListKey);
      expect(queueListKey).toBe(
        `${chainId}_queue_multisig_transactions_${safeAddress}`,
      );
    });
  });

  describe('getQueuedTransactionsCacheDir', () => {
    const chainId = '1';
    const safeAddress = getAddress(faker.finance.ethereumAddress());

    it('Should produce a cache dir under the queue_multisig_transactions key with a queue_-prefixed field', () => {
      const dir = CacheRouter.getQueuedTransactionsCacheDir({
        chainId,
        safeAddress,
        ordering: 'nonce',
        limit: 10,
        offset: 0,
      });

      expect(dir.key).toBe(
        `${chainId}_queue_multisig_transactions_${safeAddress}`,
      );
      expect(dir.field).toBe('queue_nonce_10_0');
    });
  });

  describe('getQueueMessageByHashCacheDir', () => {
    const chainId = '1';
    const messageHash = faker.string.hexadecimal({ length: 64 });

    it('Should produce a key under the queue_message namespace, distinct from the tx-service key', () => {
      const queueDir = CacheRouter.getQueueMessageByHashCacheDir({
        chainId,
        messageHash,
      });
      const txDir = CacheRouter.getMessageByHashCacheDir({
        chainId,
        messageHash,
      });

      expect(queueDir.key).not.toBe(txDir.key);
      expect(queueDir.key).toBe(`${chainId}_queue_message_${messageHash}`);
    });
  });

  describe('getQueueMessagesBySafeCacheDir', () => {
    const chainId = '1';
    const safeAddress = getAddress(faker.finance.ethereumAddress());

    it('Should produce a key under the queue_messages namespace, distinct from the tx-service key', () => {
      const queueDir = CacheRouter.getQueueMessagesBySafeCacheDir({
        chainId,
        safeAddress,
        limit: 5,
        offset: 0,
      });
      const txDir = CacheRouter.getMessagesBySafeCacheDir({
        chainId,
        safeAddress,
        limit: 5,
        offset: 0,
      });

      expect(queueDir.key).not.toBe(txDir.key);
      expect(queueDir.key).toBe(`${chainId}_queue_messages_${safeAddress}`);
      expect(queueDir.field).toBe('5_0');
    });
  });

  describe('getQueueDelegatesCacheKey', () => {
    const chainId = '1';
    const safeAddress = getAddress(faker.finance.ethereumAddress());

    it('Should produce a key under the queue_delegates namespace, distinct from the tx-service key', () => {
      const queueKey = CacheRouter.getQueueDelegatesCacheKey({
        chainId,
        safeAddress,
      });
      const txKey = CacheRouter.getDelegatesCacheKey({
        chainId,
        safeAddress,
      });

      expect(queueKey).not.toBe(txKey);
      expect(queueKey).toBe(`${chainId}_queue_delegates_${safeAddress}`);
    });
  });
});
