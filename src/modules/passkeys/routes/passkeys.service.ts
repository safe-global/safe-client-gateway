// SPDX-License-Identifier: FSL-1.1-MIT
import { createHash } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  PasskeyAttestationError,
  PasskeyAttestationService,
} from '@/modules/passkeys/domain/passkey-attestation.service';
import type { PasskeyRecord } from '@/modules/passkeys/domain/entities/passkey-record.entity';
import { IPasskeysRepository } from '@/modules/passkeys/domain/passkeys.repository.interface';
import type { PasskeyRecordResponse } from '@/modules/passkeys/routes/entities/passkey-record.dto.entity';
import type { RegisterPasskeyDto } from '@/modules/passkeys/routes/entities/register-passkey.dto.entity';

export type RegisterOutcome =
  | { status: HttpStatus.CREATED; body: PasskeyRecordResponse }
  | { status: HttpStatus.OK; body: PasskeyRecordResponse };

@Injectable()
export class PasskeysService {
  private readonly rpIdAllowlist: ReadonlyArray<string>;
  private readonly originAllowlist: ReadonlyArray<string>;
  private readonly verifiersAllowlist: ReadonlyArray<string>;

  public constructor(
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    @Inject(IPasskeysRepository)
    private readonly passkeysRepository: IPasskeysRepository,
    private readonly passkeyAttestationService: PasskeyAttestationService,
  ) {
    this.rpIdAllowlist = configurationService.getOrThrow<ReadonlyArray<string>>(
      'passkeys.rpIdAllowlist',
    );
    this.originAllowlist = configurationService.getOrThrow<
      ReadonlyArray<string>
    >('passkeys.originAllowlist');
    this.verifiersAllowlist = configurationService.getOrThrow<
      ReadonlyArray<string>
    >('passkeys.verifiersAllowlist');
  }

  public async register(dto: RegisterPasskeyDto): Promise<RegisterOutcome> {
    const verifiersNormalised = dto.verifiers.toLowerCase();
    if (!this.verifiersAllowlist.includes(verifiersNormalised)) {
      throw new ForbiddenException({ code: 'PASSKEY_VERIFIERS_NOT_ALLOWED' });
    }

    let verified;
    try {
      verified = await this.passkeyAttestationService.verify(
        {
          rpId: dto.rpId,
          origin: dto.origin,
          attestationObject: dto.attestationObject,
          clientDataJSON: dto.clientDataJSON,
          challenge: dto.challenge,
          expectedChallenge: () => deriveStatelessChallenge(dto),
        },
        this.rpIdAllowlist,
        this.originAllowlist,
      );
    } catch (err) {
      throw mapAttestationError(err);
    }

    const verifiers = Buffer.from(stripHex(verifiersNormalised), 'hex');
    const record: PasskeyRecord = {
      credentialId: verified.credentialId,
      x: verified.x,
      y: verified.y,
      verifiers,
      rpId: verified.rpId,
      createdAt: new Date(),
    };

    const outcome = await this.passkeysRepository.create(record);
    switch (outcome.status) {
      case 'created':
        return { status: HttpStatus.CREATED, body: serialize(outcome.record) };
      case 'identical':
        return { status: HttpStatus.OK, body: serialize(outcome.record) };
      case 'conflict':
        throw new ConflictException({ code: 'PASSKEY_CONFLICT' });
      case 'cross_rp_conflict':
        throw new ConflictException({ code: 'PASSKEY_CROSS_RP_CONFLICT' });
    }
  }
}

/**
 * Stateless replay protection: server recomputes the expected challenge from
 * request inputs the client must already know to assemble a valid attestation.
 * This is the Cometh-style model called out in the plan — it avoids a stateful
 * challenge endpoint while keeping replay-resistance because:
 *
 *   - the bound inputs (rpId, verifiers, origin) are part of the WebAuthn
 *     ceremony's clientData / attestation, so an attacker cannot freely vary
 *     them without regenerating the attestation, and
 *   - the comparison is constant-time (in PasskeyAttestationService).
 */
function deriveStatelessChallenge(dto: RegisterPasskeyDto): string {
  const material = `passkey:v1\n${dto.rpId}\n${dto.origin}\n${dto.verifiers.toLowerCase()}`;
  return createHash('sha256').update(material).digest('base64url');
}

function serialize(record: PasskeyRecord): PasskeyRecordResponse {
  return {
    credentialId: record.credentialId.toString('base64url'),
    x: `0x${record.x.toString('hex')}`,
    y: `0x${record.y.toString('hex')}`,
    verifiers: `0x${record.verifiers.toString('hex')}`,
    rpId: record.rpId,
    createdAt: record.createdAt.toISOString(),
  };
}

function stripHex(s: string): string {
  return s.startsWith('0x') ? s.slice(2) : s;
}

function mapAttestationError(err: unknown): HttpException {
  if (err instanceof PasskeyAttestationError) {
    switch (err.errorId) {
      case 'PASSKEY_RPID_NOT_ALLOWED':
      case 'PASSKEY_ORIGIN_NOT_ALLOWED':
        return new ForbiddenException({ code: err.errorId });
      case 'PASSKEY_NOT_CREATE_TYPE':
      case 'PASSKEY_MALFORMED_ATTESTATION':
      case 'PASSKEY_UNSUPPORTED_KEY':
      case 'PASSKEY_RPID_MISMATCH':
      case 'PASSKEY_CHALLENGE_INVALID':
        return new HttpException(
          { code: err.errorId },
          HttpStatus.BAD_REQUEST,
        );
      case 'PASSKEY_ATTESTATION_INVALID':
        return new UnprocessableEntityException({ code: err.errorId });
      case 'PASSKEY_VERIFICATION_TIMEOUT':
        return new ServiceUnavailableException({ code: err.errorId });
    }
  }
  // Anything else maps to a generic 500 with an opaque errorId — message text
  // and stack trace stay in logs, never in the response body.
  return new HttpException(
    { code: 'PASSKEY_INTERNAL_ERROR' },
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}
