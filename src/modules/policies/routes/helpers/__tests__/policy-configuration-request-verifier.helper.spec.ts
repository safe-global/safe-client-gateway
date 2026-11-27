// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { HttpStatus } from '@nestjs/common';
import { getAddress, type Hex, keccak256, toHex, zeroAddress } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import { SignatureType } from '#/domain/common/entities/signature-type.entity';
import { HttpExceptionNoLog } from '#/domain/common/errors/http-exception-no-log.error';
import {
  getMalformedSignature,
  getSignature,
} from '#/domain/common/utils/__tests__/signatures.builder';
import { DataSourceError } from '#/domain/errors/data-source.error';
import { requestConfigurationEncoder } from '#/modules/policies/domain/contracts/__tests__/encoders/safe-policy-guard-encoder.builder';
import {
  getSafePolicyGuardDeployments,
  POLICY_ENGINE_CHAIN_IDS,
} from '#/modules/policies/domain/policy-deployments.constants';
import { PolicyConfigurationRequestVerifier } from '#/modules/policies/routes/helpers/policy-configuration-request-verifier.helper';
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';
import type { Safe } from '#/modules/safe/domain/entities/safe.entity';
import type { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';

const CHAIN_ID = faker.helpers.arrayElement([...POLICY_ENGINE_CHAIN_IDS]);
const GUARD = faker.helpers.arrayElement(
  getSafePolicyGuardDeployments(CHAIN_ID),
);

describe('PolicyConfigurationRequestVerifier', () => {
  const safeRepository: MockedObject<
    Pick<ISafeRepository, 'getSafe' | 'getMultiSigTransaction'>
  > = {
    getSafe: vi.fn(),
    getMultiSigTransaction: vi.fn(),
  };

  function verifierWith(
    args: { ethSign: boolean } = { ethSign: true },
  ): PolicyConfigurationRequestVerifier {
    const configurationService = new FakeConfigurationService();
    configurationService.set('features.ethSign', args.ethSign);
    return new PolicyConfigurationRequestVerifier(
      safeRepository as MockedObject<ISafeRepository>,
      configurationService,
    );
  }

  const owner = privateKeyToAccount(generatePrivateKey());
  const root = keccak256(toHex(faker.string.alphanumeric(32)));

  function aSafe(): Safe {
    return safeBuilder()
      .with('owners', [
        owner.address,
        getAddress(faker.finance.ethereumAddress()),
      ])
      .with('guard', GUARD)
      .with('moduleGuard', zeroAddress)
      .build();
  }

  /** A transaction queued on {@link safe} requesting {@link root}, confirmed by the owner. */
  async function aQueuedRequest(
    safe: Safe,
    signatureType: SignatureType = SignatureType.Eoa,
  ): Promise<MultisigTransaction> {
    return await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('to', GUARD)
      .with(
        'data',
        requestConfigurationEncoder().with('configureRoot', root).encode(),
      )
      .with('operation', Operation.CALL)
      .with('isExecuted', false)
      .with('nonce', safe.nonce)
      .buildWithConfirmations({
        chainId: CHAIN_ID,
        safe,
        signers: [owner],
        signatureType,
      });
  }

  function mockUpstream(safe: Safe, transaction: MultisigTransaction): void {
    safeRepository.getSafe.mockResolvedValue(safe);
    safeRepository.getMultiSigTransaction.mockResolvedValue(transaction);
  }

  async function verify(args: {
    safe: Safe;
    transaction: MultisigTransaction;
    signature?: Hex;
    verifier?: PolicyConfigurationRequestVerifier;
  }): Promise<unknown> {
    const signature =
      args.signature ??
      (await getSignature({
        signer: owner,
        hash: args.transaction.safeTxHash,
        signatureType: SignatureType.Eoa,
      }));
    return (args.verifier ?? verifierWith()).verify({
      safe: { chainId: CHAIN_ID, address: args.safe.address },
      root,
      safeTxHash: args.transaction.safeTxHash,
      signature,
    });
  }

  function rejection(message: string): HttpExceptionNoLog {
    return new HttpExceptionNoLog(message, HttpStatus.UNPROCESSABLE_ENTITY);
  }

  it('should accept a queued request of the root signed by an owner', async () => {
    const safe = aSafe();
    const transaction = await aQueuedRequest(safe);
    mockUpstream(safe, transaction);

    await expect(verify({ safe, transaction })).resolves.toBeUndefined();
    expect(safeRepository.getMultiSigTransaction).toHaveBeenCalledWith({
      chainId: CHAIN_ID,
      safeTransactionHash: transaction.safeTxHash,
    });
  });

  it('should accept a request on the policy guard in the module guard slot', async () => {
    const safe = { ...aSafe(), guard: zeroAddress, moduleGuard: GUARD };
    const transaction = await aQueuedRequest(safe);
    mockUpstream(safe, transaction);

    await expect(verify({ safe, transaction })).resolves.toBeUndefined();
  });

  it('should accept an eth_sign signature when eth_sign is enabled', async () => {
    const safe = aSafe();
    const transaction = await aQueuedRequest(safe);
    mockUpstream(safe, transaction);
    const signature = await getSignature({
      signer: owner,
      hash: transaction.safeTxHash,
      signatureType: SignatureType.EthSign,
    });

    await expect(
      verify({ safe, transaction, signature }),
    ).resolves.toBeUndefined();
  });

  it('should reject an eth_sign signature when eth_sign is disabled', async () => {
    const safe = aSafe();
    const transaction = await aQueuedRequest(safe);
    mockUpstream(safe, transaction);
    const signature = await getSignature({
      signer: owner,
      hash: transaction.safeTxHash,
      signatureType: SignatureType.EthSign,
    });

    await expect(
      verify({
        safe,
        transaction,
        signature,
        verifier: verifierWith({ ethSign: false }),
      }),
    ).rejects.toThrow(rejection('eth_sign is disabled'));
  });

  describe.each([SignatureType.ContractSignature, SignatureType.ApprovedHash])(
    '%s',
    (signatureType) => {
      it('should accept a signature the queued transaction is confirmed with', async () => {
        const safe = aSafe();
        const transaction = await aQueuedRequest(safe, signatureType);
        mockUpstream(safe, transaction);
        const [confirmation] = transaction.confirmations ?? [];

        await expect(
          verify({ safe, transaction, signature: confirmation.signature! }),
        ).resolves.toBeUndefined();
      });

      it('should reject a signature the queued transaction is not confirmed with', async () => {
        const safe = aSafe();
        const transaction = {
          ...(await aQueuedRequest(safe, signatureType)),
          confirmations: [],
        };
        mockUpstream(safe, transaction);
        const signature = await getSignature({
          signer: owner,
          hash: transaction.safeTxHash,
          signatureType,
        });

        await expect(verify({ safe, transaction, signature })).rejects.toThrow(
          rejection('Invalid signature'),
        );
      });
    },
  );

  it('should reject a transaction the Transaction Service does not hold', async () => {
    const safe = aSafe();
    const transaction = await aQueuedRequest(safe);
    safeRepository.getSafe.mockResolvedValue(safe);
    safeRepository.getMultiSigTransaction.mockRejectedValue(
      new DataSourceError('Not found', HttpStatus.NOT_FOUND),
    );

    await expect(verify({ safe, transaction })).rejects.toThrow(
      rejection('The Safe transaction is not queued for this Safe'),
    );
  });

  it('should forward a Transaction Service failure other than not found', async () => {
    const safe = aSafe();
    const transaction = await aQueuedRequest(safe);
    const error = new DataSourceError(
      'Service unavailable',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    safeRepository.getSafe.mockResolvedValue(safe);
    safeRepository.getMultiSigTransaction.mockRejectedValue(error);

    await expect(verify({ safe, transaction })).rejects.toBe(error);
  });

  it('should reject a transaction queued on another Safe', async () => {
    const safe = aSafe();
    const otherSafe = {
      ...aSafe(),
      address: getAddress(faker.finance.ethereumAddress()),
    };
    const transaction = await aQueuedRequest(otherSafe);
    mockUpstream(safe, transaction);

    await expect(verify({ safe, transaction })).rejects.toThrow(
      rejection('The Safe transaction is not queued for this Safe'),
    );
  });

  it('should reject an executed transaction', async () => {
    const safe = aSafe();
    const transaction = {
      ...(await aQueuedRequest(safe)),
      isExecuted: true,
    };
    mockUpstream(safe, transaction);

    await expect(verify({ safe, transaction })).rejects.toThrow(
      rejection('The Safe transaction is not queued for this Safe'),
    );
  });

  it('should reject a transaction below the Safe nonce', async () => {
    const safe = { ...aSafe(), nonce: faker.number.int({ min: 1 }) };
    const transaction = await aQueuedRequest(safe);
    mockUpstream({ ...safe, nonce: safe.nonce + 1 }, transaction);

    await expect(verify({ safe, transaction })).rejects.toThrow(
      rejection('The Safe transaction is not queued for this Safe'),
    );
  });

  it('should reject a transaction whose fields do not hash to its safeTxHash', async () => {
    const safe = aSafe();
    const transaction = {
      ...(await aQueuedRequest(safe)),
      value: faker.string.numeric({ length: 3, exclude: ['0'] }),
    };
    mockUpstream(safe, transaction);

    await expect(verify({ safe, transaction })).rejects.toThrow(
      rejection('Invalid safeTxHash'),
    );
  });

  it('should reject a transaction requesting another root', async () => {
    const safe = aSafe();
    const transaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('to', GUARD)
      .with('data', requestConfigurationEncoder().encode())
      .with('operation', Operation.CALL)
      .with('isExecuted', false)
      .with('nonce', safe.nonce)
      .buildWithConfirmations({
        chainId: CHAIN_ID,
        safe,
        signers: [owner],
        signatureType: SignatureType.Eoa,
      });
    mockUpstream(safe, transaction);

    await expect(verify({ safe, transaction })).rejects.toThrow(
      rejection('The Safe transaction does not request the configuration root'),
    );
  });

  it('should reject a delegatecall of the request', async () => {
    const safe = aSafe();
    const transaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('to', GUARD)
      .with(
        'data',
        requestConfigurationEncoder().with('configureRoot', root).encode(),
      )
      .with('operation', Operation.DELEGATE)
      .with('isExecuted', false)
      .with('nonce', safe.nonce)
      .buildWithConfirmations({
        chainId: CHAIN_ID,
        safe,
        signers: [owner],
        signatureType: SignatureType.Eoa,
      });
    mockUpstream(safe, transaction);

    await expect(verify({ safe, transaction })).rejects.toThrow(
      rejection('The Safe transaction does not request the configuration root'),
    );
  });

  it('should reject a request on a policy guard the Safe has not enabled', async () => {
    const otherGuard = getSafePolicyGuardDeployments(CHAIN_ID).find(
      (guard) => guard !== GUARD,
    )!;
    const safe = { ...aSafe(), guard: otherGuard };
    const transaction = await aQueuedRequest(safe);
    mockUpstream(safe, transaction);

    await expect(verify({ safe, transaction })).rejects.toThrow(
      rejection("The Safe transaction does not target the Safe's policy guard"),
    );
  });

  it('should reject a request on an enabled guard that is not a known policy guard', async () => {
    const unknownGuard = getAddress(faker.finance.ethereumAddress());
    const safe = { ...aSafe(), guard: unknownGuard };
    const transaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('to', unknownGuard)
      .with(
        'data',
        requestConfigurationEncoder().with('configureRoot', root).encode(),
      )
      .with('operation', Operation.CALL)
      .with('isExecuted', false)
      .with('nonce', safe.nonce)
      .buildWithConfirmations({
        chainId: CHAIN_ID,
        safe,
        signers: [owner],
        signatureType: SignatureType.Eoa,
      });
    mockUpstream(safe, transaction);

    await expect(verify({ safe, transaction })).rejects.toThrow(
      rejection("The Safe transaction does not target the Safe's policy guard"),
    );
  });

  it('should reject a signature of someone who is not an owner', async () => {
    const safe = aSafe();
    const transaction = await aQueuedRequest(safe);
    mockUpstream(safe, transaction);
    const signature = await getSignature({
      signer: privateKeyToAccount(generatePrivateKey()),
      hash: transaction.safeTxHash,
      signatureType: SignatureType.Eoa,
    });

    await expect(verify({ safe, transaction, signature })).rejects.toThrow(
      rejection('Invalid signature'),
    );
  });

  it('should reject a signature of another hash', async () => {
    const safe = aSafe();
    const transaction = await aQueuedRequest(safe);
    mockUpstream(safe, transaction);
    const signature = await getSignature({
      signer: owner,
      hash: keccak256(toHex(faker.string.alphanumeric(32))),
      signatureType: SignatureType.Eoa,
    });

    await expect(verify({ safe, transaction, signature })).rejects.toThrow(
      rejection('Invalid signature'),
    );
  });

  it('should reject a malformed signature', async () => {
    const safe = aSafe();
    const transaction = await aQueuedRequest(safe);
    mockUpstream(safe, transaction);

    await expect(
      verify({
        safe,
        transaction,
        signature: getMalformedSignature('Could not recover address'),
      }),
    ).rejects.toThrow(rejection('Invalid signature'));
  });
});
