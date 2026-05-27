// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import {
  type VerifiedRegistrationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import {
  cose,
  decodeCredentialPublicKey,
} from '@simplewebauthn/server/helpers';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import type { VerifiedPasskey } from '@/modules/passkeys/domain/entities/verified-passkey.entity';
import type { VerifyAttestationInput } from '@/modules/passkeys/domain/entities/verify-attestation-input.entity';
import { PasskeyAttestationError } from '@/modules/passkeys/domain/errors/passkey-attestation.error';
import {
  pad32,
  parseClientDataJSON,
  timingSafeEqualBase64Url,
} from '@/modules/passkeys/domain/passkey-attestation.helpers';

type RegistrationInfo = NonNullable<
  VerifiedRegistrationResponse['registrationInfo']
>;

@Injectable()
export class PasskeyAttestationService {
  private readonly verificationTimeoutMs: number;

  public constructor(
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.verificationTimeoutMs = configurationService.getOrThrow<number>(
      'passkeys.verificationTimeoutMs',
    );
  }

  /**
   * Verify a WebAuthn registration (attestation) response and return the
   * canonical passkey material. Throws {@link PasskeyAttestationError} for
   * every recoverable failure mode — see
   * {@link PasskeyAttestationErrorId} for the stable error codes.
   *
   * The RP ID and origin allowlists are passed in by the caller rather than
   * read from config here so the service stays decoupled from the
   * registration endpoint's configuration shape.
   */
  public async verify(
    input: VerifyAttestationInput,
    rpIdAllowlist: ReadonlyArray<string>,
    originAllowlist: ReadonlyArray<string>,
  ): Promise<VerifiedPasskey> {
    this.assertAllowlisted(input, rpIdAllowlist, originAllowlist);
    this.assertCreateCeremony(input.clientDataJSON);

    const info = await this.runLibraryVerification(
      input,
      rpIdAllowlist,
      originAllowlist,
    );

    return this.extractPasskey(info, input.rpId);
  }

  /**
   * Reject requests whose `rpId` / `origin` are outside the caller's
   * allowlist before any expensive crypto work runs.
   */
  private assertAllowlisted(
    input: VerifyAttestationInput,
    rpIdAllowlist: ReadonlyArray<string>,
    originAllowlist: ReadonlyArray<string>,
  ): void {
    if (!rpIdAllowlist.includes(input.rpId)) {
      throw new PasskeyAttestationError('PASSKEY_RPID_NOT_ALLOWED');
    }
    if (!originAllowlist.includes(input.origin)) {
      throw new PasskeyAttestationError('PASSKEY_ORIGIN_NOT_ALLOWED');
    }
  }

  /**
   * clientDataJSON.type must be `webauthn.create` for a registration
   * ceremony. We surface a tighter errorId for assertion-shaped requests
   * (`webauthn.get`) before handing off to the library.
   */
  private assertCreateCeremony(clientDataJSON: string): void {
    const clientData = parseClientDataJSON(clientDataJSON);
    if (clientData.type !== 'webauthn.create') {
      throw new PasskeyAttestationError('PASSKEY_NOT_CREATE_TYPE');
    }
  }

  /**
   * Drive `@simplewebauthn/server` under our timeout wrapper and translate
   * any library-thrown error into a {@link PasskeyAttestationError}. Returns
   * the verified `registrationInfo` block.
   */
  private async runLibraryVerification(
    input: VerifyAttestationInput,
    rpIdAllowlist: ReadonlyArray<string>,
    originAllowlist: ReadonlyArray<string>,
  ): Promise<RegistrationInfo> {
    const verification = await this.runWithTimeout(() =>
      verifyRegistrationResponse({
        response: {
          // The client supplies attestationObject + clientDataJSON; the
          // library decodes the credentialId out of attestationObject.
          // We pass an empty id/rawId here — they are echoed for clients that
          // round-trip them but are not used in signature verification.
          id: '',
          rawId: '',
          response: {
            attestationObject: input.attestationObject,
            clientDataJSON: input.clientDataJSON,
          },
          type: 'public-key',
          clientExtensionResults: {},
        },
        expectedChallenge: (clientChallenge: string) => {
          const expected = input.expectedChallenge();
          return timingSafeEqualBase64Url(clientChallenge, expected);
        },
        expectedOrigin: [...originAllowlist],
        expectedRPID: [...rpIdAllowlist],
        requireUserPresence: true,
        // Synced credentials may not assert UV on the second device.
        requireUserVerification: false,
        // ES256 only — refuse RS256 / EdDSA / anything else.
        supportedAlgorithmIDs: [-7],
      }),
    ).catch((err) => this.mapLibraryError(err));

    if (!(verification.verified && verification.registrationInfo)) {
      throw new PasskeyAttestationError('PASSKEY_ATTESTATION_INVALID');
    }
    return verification.registrationInfo;
  }

  /**
   * Decode the COSE public key from the verified attestation and assemble
   * the {@link VerifiedPasskey} output. Enforces ES256 / P-256 / EC2 — any
   * other key shape becomes `PASSKEY_UNSUPPORTED_KEY`.
   */
  private extractPasskey(
    info: RegistrationInfo,
    fallbackRpId: string,
  ): VerifiedPasskey {
    const decoded = decodeCredentialPublicKey(info.credential.publicKey);
    if (!cose.isCOSEPublicKeyEC2(decoded)) {
      throw new PasskeyAttestationError('PASSKEY_UNSUPPORTED_KEY');
    }
    const kty = decoded.get(cose.COSEKEYS.kty);
    const alg = decoded.get(cose.COSEKEYS.alg);
    const crv = decoded.get(cose.COSEKEYS.crv);
    const xRaw = decoded.get(cose.COSEKEYS.x);
    const yRaw = decoded.get(cose.COSEKEYS.y);

    if (
      kty !== cose.COSEKTY.EC2 ||
      crv !== cose.COSECRV.P256 ||
      alg !== cose.COSEALG.ES256
    ) {
      throw new PasskeyAttestationError('PASSKEY_UNSUPPORTED_KEY');
    }
    if (!(xRaw && yRaw)) {
      throw new PasskeyAttestationError('PASSKEY_UNSUPPORTED_KEY');
    }

    return {
      x: pad32(xRaw),
      y: pad32(yRaw),
      credentialId: Buffer.from(info.credential.id),
      rpId: info.rpID ?? fallbackRpId,
      alg,
    };
  }

  /**
   * Race the verifier against a configured timeout. The timeout does NOT
   * interrupt synchronous CPU work inside the library — cancellation is
   * best-effort and the orphaned inner promise's late rejection is observed
   * here so Node does not treat it as `unhandledRejection`.
   */
  private async runWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    let timedOut = false;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        reject(new PasskeyAttestationError('PASSKEY_VERIFICATION_TIMEOUT'));
      }, this.verificationTimeoutMs);
    });
    const work = fn();
    work.catch((err: unknown) => {
      if (!timedOut) return;
      this.loggingService.warn({
        event: 'passkey_verification_late_rejection',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    });
    try {
      return await Promise.race([work, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Translate errors thrown by `@simplewebauthn/server` into our error
   * taxonomy. Decode-shaped errors (SyntaxError / RangeError) become
   * `PASSKEY_MALFORMED_ATTESTATION`; anything else is logged and rethrown so
   * the service layer can map it to a 500.
   */
  private mapLibraryError(err: unknown): never {
    if (err instanceof PasskeyAttestationError) throw err;
    if (err instanceof SyntaxError || err instanceof RangeError) {
      throw new PasskeyAttestationError('PASSKEY_MALFORMED_ATTESTATION');
    }
    if (err instanceof Error) {
      this.loggingService.error({
        event: 'passkey_attestation_library_error',
        message: err.message,
        stack: err.stack,
      });
      throw err;
    }
    // Non-Error throws (strings, etc.) — treat as malformed; nothing useful
    // to log and we do not want to surface arbitrary thrown values.
    throw new PasskeyAttestationError('PASSKEY_MALFORMED_ATTESTATION');
  }
}
