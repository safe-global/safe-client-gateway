// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpStatus } from '@nestjs/common';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { WriteOutcomeStatus } from '@/modules/passkeys/domain/entities/passkey-record.entity';
import type { VerifiedPasskey } from '@/modules/passkeys/domain/entities/verified-passkey.entity';
import { PasskeyAttestationError } from '@/modules/passkeys/domain/errors/passkey-attestation.error';
import type { PasskeyAttestationService } from '@/modules/passkeys/domain/passkey-attestation.service';
import type { IPasskeysRepository } from '@/modules/passkeys/domain/passkeys.repository.interface';
import { PasskeysService } from '@/modules/passkeys/routes/passkeys.service';

const VERIFIERS_HEX = `0x${'a1'.repeat(22)}`;

function buildConfig(
  overrides: Partial<{
    rpIdAllowlist: ReadonlyArray<string>;
    originAllowlist: ReadonlyArray<string>;
  }> = {},
): IConfigurationService {
  const values: Record<string, ReadonlyArray<string>> = {
    'passkeys.rpIdAllowlist': overrides.rpIdAllowlist ?? ['app.safe.global'],
    'passkeys.originAllowlist': overrides.originAllowlist ?? [
      'https://app.safe.global',
    ],
  };
  return {
    get: jest.fn(),
    getOrThrow: jest.fn((key: string) => values[key]),
  } as unknown as IConfigurationService;
}

function buildVerified(
  overrides: Partial<VerifiedPasskey> = {},
): VerifiedPasskey {
  return {
    x: Buffer.alloc(32, 0xab),
    y: Buffer.alloc(32, 0xcd),
    credentialId: Buffer.from('credential-id-bytes'),
    rpId: 'app.safe.global',
    alg: -7,
    ...overrides,
  };
}

function buildDto(
  overrides: Partial<{
    rpId: string;
    origin: string;
    verifiers: string;
  }> = {},
): Parameters<PasskeysService['register']>[0] {
  return {
    rpId: overrides.rpId ?? 'app.safe.global',
    origin: overrides.origin ?? 'https://app.safe.global',
    verifiers: overrides.verifiers ?? VERIFIERS_HEX,
    attestationObject: 'a-b64url-string',
    clientDataJSON: 'a-b64url-string',
    challenge: 'a-b64url-string',
  };
}

interface Mocks {
  attestation: jest.Mocked<Pick<PasskeyAttestationService, 'verify'>>;
  repo: jest.Mocked<IPasskeysRepository>;
  logging: jest.Mocked<ILoggingService>;
  service: PasskeysService;
}

function buildService(): Mocks {
  const attestation = {
    verify: jest.fn(),
  } as jest.Mocked<Pick<PasskeyAttestationService, 'verify'>>;
  const repo: jest.Mocked<IPasskeysRepository> = {
    create: jest.fn(),
    findByCredentialId: jest.fn(),
  };
  const logging: jest.Mocked<ILoggingService> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as jest.Mocked<ILoggingService>;
  const service = new PasskeysService(
    buildConfig(),
    repo,
    attestation as unknown as PasskeyAttestationService,
    logging,
  );
  return { attestation, repo, logging, service };
}

describe('PasskeysService.register', () => {
  it('returns 201 when the row is newly inserted', async () => {
    const { attestation, repo, service } = buildService();
    const verified = buildVerified();
    attestation.verify.mockResolvedValue(verified);
    repo.create.mockResolvedValue({
      status: WriteOutcomeStatus.CREATED,
      record: {
        ...verified,
        verifiers: Buffer.from(VERIFIERS_HEX.slice(2), 'hex'),
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    });

    const outcome = await service.register(buildDto());

    expect(outcome.status).toBe(HttpStatus.CREATED);
    expect(outcome.body.x).toBe(`0x${'ab'.repeat(32)}`);
    expect(outcome.body.y).toBe(`0x${'cd'.repeat(32)}`);
    expect(outcome.body.verifiers).toBe(VERIFIERS_HEX);
  });

  it('returns 200 when the existing row is identical', async () => {
    const { attestation, repo, service } = buildService();
    const verified = buildVerified();
    attestation.verify.mockResolvedValue(verified);
    repo.create.mockResolvedValue({
      status: WriteOutcomeStatus.IDENTICAL,
      record: {
        ...verified,
        verifiers: Buffer.from(VERIFIERS_HEX.slice(2), 'hex'),
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    });

    const outcome = await service.register(buildDto());
    expect(outcome.status).toBe(HttpStatus.OK);
  });

  it.each([
    [
      'PASSKEY_RPID_NOT_ALLOWED',
      HttpStatus.FORBIDDEN,
      'PASSKEY_RPID_NOT_ALLOWED',
    ],
    [
      'PASSKEY_ORIGIN_NOT_ALLOWED',
      HttpStatus.FORBIDDEN,
      'PASSKEY_ORIGIN_NOT_ALLOWED',
    ],
    [
      'PASSKEY_NOT_CREATE_TYPE',
      HttpStatus.BAD_REQUEST,
      'PASSKEY_NOT_CREATE_TYPE',
    ],
    [
      'PASSKEY_MALFORMED_ATTESTATION',
      HttpStatus.BAD_REQUEST,
      'PASSKEY_MALFORMED_ATTESTATION',
    ],
    [
      'PASSKEY_UNSUPPORTED_KEY',
      HttpStatus.BAD_REQUEST,
      'PASSKEY_UNSUPPORTED_KEY',
    ],
    ['PASSKEY_RPID_MISMATCH', HttpStatus.BAD_REQUEST, 'PASSKEY_RPID_MISMATCH'],
    [
      'PASSKEY_ATTESTATION_INVALID',
      HttpStatus.UNPROCESSABLE_ENTITY,
      'PASSKEY_ATTESTATION_INVALID',
    ],
    [
      'PASSKEY_VERIFICATION_TIMEOUT',
      HttpStatus.SERVICE_UNAVAILABLE,
      'PASSKEY_VERIFICATION_TIMEOUT',
    ],
  ] as const)('maps attestation error %s to HTTP %d with code %s', async (errorId, status, code) => {
    const { attestation, service } = buildService();
    attestation.verify.mockRejectedValue(new PasskeyAttestationError(errorId));
    await expect(service.register(buildDto())).rejects.toMatchObject({
      status,
      response: { code, message: expect.any(String) },
    });
  });

  it.each([
    [WriteOutcomeStatus.CONFLICT, 'PASSKEY_CONFLICT'],
    [WriteOutcomeStatus.CROSS_RP_CONFLICT, 'PASSKEY_CROSS_RP_CONFLICT'],
  ] as const)('returns 409 %s', async (status, code) => {
    const { attestation, repo, service } = buildService();
    attestation.verify.mockResolvedValue(buildVerified());
    repo.create.mockResolvedValue({ status });
    await expect(service.register(buildDto())).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: { code, message: expect.any(String) },
    });
  });

  it('round-trips a credentialId via lookup', async () => {
    const { repo, service } = buildService();
    const credentialId = Buffer.from('round-trip-credential-id');
    const x = Buffer.alloc(32, 0x01);
    const y = Buffer.alloc(32, 0x02);
    const verifiers = Buffer.alloc(22, 0x03);
    repo.findByCredentialId.mockResolvedValue({
      credentialId,
      x,
      y,
      verifiers,
      rpId: 'app.safe.global',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });

    const { body, etag } = await service.lookup(
      credentialId.toString('base64url'),
    );

    expect(body.credentialId).toBe(credentialId.toString('base64url'));
    expect(body.x).toBe(`0x${'01'.repeat(32)}`);
    expect(body.y).toBe(`0x${'02'.repeat(32)}`);
    expect(body.verifiers).toBe(`0x${'03'.repeat(22)}`);
    expect(etag).toBe(`"${credentialId.subarray(0, 16).toString('hex')}"`);
  });

  it('returns 404 PASSKEY_NOT_FOUND when no record exists', async () => {
    const { repo, service } = buildService();
    repo.findByCredentialId.mockResolvedValue(null);
    await expect(service.lookup('AQID')).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: {
        code: 'PASSKEY_NOT_FOUND',
        message: expect.any(String),
      },
    });
  });

  it.each([
    ['empty', ''],
    ['non-base64url', 'not valid!'],
    ['too long', 'a'.repeat(2000)],
  ])('returns 400 PASSKEY_INVALID_CREDENTIAL_ID for %s input', async (_, val) => {
    const { service } = buildService();
    await expect(service.lookup(val)).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: {
        code: 'PASSKEY_INVALID_CREDENTIAL_ID',
        message: expect.any(String),
      },
    });
  });

  it('maps unexpected attestation errors to 500 PASSKEY_INTERNAL_ERROR', async () => {
    const { attestation, logging, service } = buildService();
    const cause = new Error('boom');
    attestation.verify.mockRejectedValue(cause);
    await expect(service.register(buildDto())).rejects.toMatchObject({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      response: {
        code: 'PASSKEY_INTERNAL_ERROR',
        message: expect.any(String),
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      },
      cause,
    });
    expect(logging.error).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'passkey_internal_error',
        message: 'boom',
      }),
    );
  });
});
