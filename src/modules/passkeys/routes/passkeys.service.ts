// SPDX-License-Identifier: FSL-1.1-MIT
import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import {
  type PasskeyRecord,
  WriteOutcomeStatus,
} from '@/modules/passkeys/domain/entities/passkey-record.entity';
import type { VerifiedPasskey } from '@/modules/passkeys/domain/entities/verified-passkey.entity';
import { PasskeyAttestationError } from '@/modules/passkeys/domain/errors/passkey-attestation.error';
import { PasskeyAttestationService } from '@/modules/passkeys/domain/passkey-attestation.service';
import { IPasskeysRepository } from '@/modules/passkeys/domain/passkeys.repository.interface';
import type { PasskeyRecordResponse } from '@/modules/passkeys/routes/entities/passkey-record.dto.entity';
import type { RegisterPasskeyDto } from '@/modules/passkeys/routes/entities/register-passkey.dto.entity';

export type RegisterOutcome =
  | { status: HttpStatus.CREATED; body: PasskeyRecordResponse }
  | { status: HttpStatus.OK; body: PasskeyRecordResponse };

// Decoded credentialId byte length cap from WebAuthn L3.
const CREDENTIAL_ID_MAX_BYTES = 1023;
const CREDENTIAL_ID_MIN_BYTES = 1;

@Injectable()
export class PasskeysService {
  private readonly rpIdAllowlist: ReadonlyArray<string>;
  private readonly originAllowlist: ReadonlyArray<string>;

  public constructor(
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    @Inject(IPasskeysRepository)
    private readonly passkeysRepository: IPasskeysRepository,
    private readonly passkeyAttestationService: PasskeyAttestationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.rpIdAllowlist = configurationService.getOrThrow<ReadonlyArray<string>>(
      'passkeys.rpIdAllowlist',
    );
    this.originAllowlist = configurationService.getOrThrow<
      ReadonlyArray<string>
    >('passkeys.originAllowlist');
  }

  public async register(dto: RegisterPasskeyDto): Promise<RegisterOutcome> {
    const verifiersNormalised = dto.verifiers.toLowerCase();

    let verified: VerifiedPasskey;
    try {
      verified = await this.passkeyAttestationService.verify(
        {
          rpId: dto.rpId,
          origin: dto.origin,
          attestationObject: dto.attestationObject,
          clientDataJSON: dto.clientDataJSON,
          challenge: dto.challenge,
          expectedChallenge: () => this.deriveStatelessChallenge(dto),
        },
        this.rpIdAllowlist,
        this.originAllowlist,
      );
    } catch (err) {
      throw this.mapAttestationError(err);
    }

    const outcome = await this.passkeysRepository.create({
      credentialId: verified.credentialId,
      x: verified.x,
      y: verified.y,
      verifiers: Buffer.from(this.stripHex(verifiersNormalised), 'hex'),
      rpId: verified.rpId,
    });
    switch (outcome.status) {
      case WriteOutcomeStatus.CREATED:
        return {
          status: HttpStatus.CREATED,
          body: this.serialize(outcome.record),
        };
      case WriteOutcomeStatus.IDENTICAL:
        return { status: HttpStatus.OK, body: this.serialize(outcome.record) };
      case WriteOutcomeStatus.CONFLICT:
        throw new ConflictException({
          code: 'PASSKEY_CONFLICT',
          message: 'a different record already exists for this credentialId',
        });
      case WriteOutcomeStatus.CROSS_RP_CONFLICT:
        throw new ConflictException({
          code: 'PASSKEY_CROSS_RP_CONFLICT',
          message:
            'a record exists for this credentialId under a different rpId',
        });
    }
  }

  public async lookup(credentialIdB64Url: string): Promise<{
    body: PasskeyRecordResponse;
    etag: string;
  }> {
    const credentialId = this.decodeCredentialId(credentialIdB64Url);
    const record =
      await this.passkeysRepository.findByCredentialId(credentialId);
    if (!record) {
      throw new NotFoundException({
        code: 'PASSKEY_NOT_FOUND',
        message: 'no record for this credentialId',
      });
    }
    return {
      body: this.serialize(record),
      // ETag = first 16 bytes of credentialId; rows are immutable so the bytes
      // alone are sufficient for cache-validation and never leak data the
      // client did not already supply on the request URL.
      etag: `"${record.credentialId.subarray(0, 16).toString('hex')}"`,
    };
  }

  private mapAttestationError(err: unknown): HttpException {
    if (err instanceof PasskeyAttestationError) {
      switch (err.errorId) {
        case 'PASSKEY_RPID_NOT_ALLOWED':
          return new ForbiddenException({
            code: err.errorId,
            message: 'rpId is not in the configured allowlist',
          });
        case 'PASSKEY_ORIGIN_NOT_ALLOWED':
          return new ForbiddenException({
            code: err.errorId,
            message: 'origin is not in the configured allowlist',
          });
        case 'PASSKEY_NOT_CREATE_TYPE':
          return new HttpException(
            {
              code: err.errorId,
              message: 'clientData type is not webauthn.create',
            },
            HttpStatus.BAD_REQUEST,
          );
        case 'PASSKEY_MALFORMED_ATTESTATION':
          return new HttpException(
            {
              code: err.errorId,
              message: 'attestation payload is malformed',
            },
            HttpStatus.BAD_REQUEST,
          );
        case 'PASSKEY_UNSUPPORTED_KEY':
          return new HttpException(
            {
              code: err.errorId,
              message: 'credential public key algorithm is not supported',
            },
            HttpStatus.BAD_REQUEST,
          );
        case 'PASSKEY_RPID_MISMATCH':
          return new HttpException(
            {
              code: err.errorId,
              message: 'rpId hash does not match authenticator data',
            },
            HttpStatus.BAD_REQUEST,
          );
        case 'PASSKEY_CHALLENGE_INVALID':
          return new HttpException(
            {
              code: err.errorId,
              message: 'challenge does not match expected value',
            },
            HttpStatus.BAD_REQUEST,
          );
        case 'PASSKEY_ATTESTATION_INVALID':
          return new UnprocessableEntityException({
            code: err.errorId,
            message: 'attestation signature did not verify',
          });
        case 'PASSKEY_VERIFICATION_TIMEOUT':
          return new ServiceUnavailableException({
            code: err.errorId,
            message: 'verification timed out',
          });
      }
    }
    // Anything else maps to a generic 500 with an opaque errorId — message
    // text and stack trace stay in logs, never in the response body. We log
    // the original cause and attach it via `cause` so it's not lost.
    this.loggingService.error({
      type: 'passkey_internal_error',
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return new HttpException(
      {
        code: 'PASSKEY_INTERNAL_ERROR',
        message: 'internal server error',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
      { cause: err instanceof Error ? err : new Error(String(err)) },
    );
  }

  private decodeCredentialId(value: string): Buffer {
    // Reject anything that is not strictly base64url. We also bound the
    // encoded length to ceil(1023 * 4 / 3) = 1364 — anything longer can never
    // decode to a credentialId within the WebAuthn L3 limits.
    const ENCODED_MAX = Math.ceil((CREDENTIAL_ID_MAX_BYTES * 4) / 3);
    if (
      typeof value !== 'string' ||
      value.length === 0 ||
      value.length > ENCODED_MAX ||
      !/^[A-Za-z0-9_-]+$/.test(value)
    ) {
      throw new BadRequestException({
        code: 'PASSKEY_INVALID_CREDENTIAL_ID',
        message: 'malformed credentialId',
      });
    }
    const buf = Buffer.from(value, 'base64url');
    if (
      buf.length < CREDENTIAL_ID_MIN_BYTES ||
      buf.length > CREDENTIAL_ID_MAX_BYTES
    ) {
      throw new BadRequestException({
        code: 'PASSKEY_INVALID_CREDENTIAL_ID',
        message: 'malformed credentialId',
      });
    }
    return buf;
  }

  /**
   * Stateless replay protection: server recomputes the expected challenge
   * from request inputs the client must already know to assemble a valid
   * attestation. This is the Cometh-style model called out in the plan — it
   * avoids a stateful challenge endpoint while keeping replay-resistance
   * because:
   *
   *   - the bound inputs (rpId, verifiers, origin) are part of the WebAuthn
   *     ceremony's clientData / attestation, so an attacker cannot freely
   *     vary them without regenerating the attestation, and
   *   - the comparison is constant-time (in PasskeyAttestationService).
   */
  private deriveStatelessChallenge(dto: RegisterPasskeyDto): string {
    const material = `passkey:v1\n${dto.rpId}\n${dto.origin}\n${dto.verifiers.toLowerCase()}`;
    return createHash('sha256').update(material).digest('base64url');
  }

  private serialize(record: PasskeyRecord): PasskeyRecordResponse {
    return {
      credentialId: record.credentialId.toString('base64url'),
      x: `0x${record.x.toString('hex')}`,
      y: `0x${record.y.toString('hex')}`,
      verifiers: `0x${record.verifiers.toString('hex')}`,
      rpId: record.rpId,
      createdAt: record.createdAt.toISOString(),
    };
  }

  private stripHex(s: string): string {
    return s.startsWith('0x') ? s.slice(2) : s;
  }
}
