// SPDX-License-Identifier: FSL-1.1-MIT
import { generateKeyPairSync } from 'node:crypto';
import {
  GetPublicKeyCommand,
  type GetPublicKeyCommandOutput,
  KMSClient,
  SignCommand,
  type SignCommandInput,
} from '@aws-sdk/client-kms';
import { faker } from '@faker-js/faker';
import { secp256k1 } from '@noble/curves/secp256k1';
import { mockClient } from 'aws-sdk-client-mock';
import {
  type Address,
  bytesToHex,
  type Hex,
  hexToBytes,
  pad,
  recoverAddress,
  toHex,
} from 'viem';
import { privateKeyToAddress } from 'viem/accounts';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import { KmsSafenetPayerSigner } from '#/modules/safenet/datasources/kms-safenet-payer-signer';

const kmsMock = mockClient(KMSClient);
const keyId = faker.string.uuid();

type TestKey = { privateKey: Hex; address: Address; spki: Uint8Array };

function createKey(): TestKey {
  const pair = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
  const d = pair.privateKey.export({ format: 'jwk' }).d ?? '';
  const privateKey = pad(bytesToHex(Buffer.from(d, 'base64url')), { size: 32 });
  return {
    privateKey,
    address: privateKeyToAddress(privateKey),
    spki: pair.publicKey.export({ type: 'spki', format: 'der' }),
  };
}

const randomDigest = (): Hex =>
  toHex(faker.number.bigInt({ min: 1n, max: 2n ** 256n - 1n }), { size: 32 });

const sign = (key: TestKey, digest: Uint8Array) =>
  secp256k1.sign(digest, hexToBytes(key.privateKey));

/** Answers like KMS: the real SPKI DER of `key` and real DER signatures of the sent digest. */
function stubKms(
  key: TestKey,
  highS = false,
  publicKey: Partial<GetPublicKeyCommandOutput> = {},
) {
  kmsMock.on(GetPublicKeyCommand).resolves({
    PublicKey: key.spki,
    KeySpec: 'ECC_SECG_P256K1',
    KeyUsage: 'SIGN_VERIFY',
    ...publicKey,
  });
  kmsMock.on(SignCommand).callsFake(({ Message }: SignCommandInput) => {
    if (!Message) {
      throw new Error('The sign request has no message');
    }
    const low = sign(key, Message);
    const signature = highS
      ? new secp256k1.Signature(low.r, secp256k1.CURVE.n - low.s)
      : low;
    return { Signature: signature.toDERRawBytes() };
  });
}

describe('KmsSafenetPayerSigner', () => {
  beforeEach(() => kmsMock.reset());

  function createSigner(): KmsSafenetPayerSigner {
    const config = new FakeConfigurationService();
    config.set('safenet.payer.kms.keyId', keyId);
    config.set('safenet.payer.kms.connectionTimeoutMs', 5_000);
    config.set('safenet.payer.kms.requestTimeoutMs', 10_000);
    return new KmsSafenetPayerSigner(config);
  }

  it.each([false, true])(
    'signs a DIGEST with low-s and both v values, KMS high-s: %s',
    async (highS) => {
      const key = createKey();
      stubKms(key, highS);
      const signer = createSigner();
      const vs = new Set<string>();

      while (vs.size < 2) {
        const hash = randomDigest();
        const signature = await signer.signHash(hash);

        const low = sign(key, hexToBytes(hash));
        const v = low.recovery ? '1c' : '1b';
        expect(signature).toBe(`0x${low.toCompactHex()}${v}`);
        await expect(recoverAddress({ hash, signature })).resolves.toBe(
          key.address,
        );
        const sent = kmsMock.commandCalls(SignCommand).at(-1)?.args[0].input;
        expect(sent).toEqual({
          KeyId: keyId,
          Message: hexToBytes(hash),
          MessageType: 'DIGEST',
          SigningAlgorithm: 'ECDSA_SHA_256',
        });
        vs.add(v);
      }
    },
  );

  it('loads the public key once, and again after a failed load', async () => {
    const key = createKey();
    const signer = createSigner();
    stubKms(key, false, { PublicKey: undefined });

    await expect(signer.getAddress()).rejects.toThrow('did not return');
    stubKms(key);
    await signer.signHash(randomDigest());
    await signer.signHash(randomDigest());

    await expect(signer.getAddress()).resolves.toBe(key.address);
    expect(kmsMock.commandCalls(GetPublicKeyCommand)).toHaveLength(2);
  });

  it.each([
    ['no signature', randomDigest(), {}, 'did not return a signature'],
    [
      'a signature of another key',
      randomDigest(),
      { Signature: sign(createKey(), new Uint8Array(32)).toDERRawBytes() },
      'does not recover to the KMS key address',
    ],
  ])('rejects %s', async (_name, hash, response, message) => {
    stubKms(createKey());
    kmsMock.on(SignCommand).resolves(response);

    await expect(createSigner().signHash(hash)).rejects.toThrow(message);
  });
});
