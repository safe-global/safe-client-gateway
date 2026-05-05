// SPDX-License-Identifier: FSL-1.1-MIT
import { timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import {
  cose,
  decodeCredentialPublicKey,
} from '@simplewebauthn/server/helpers';
import { IConfigurationService } from '@/config/configuration.service.interface';

/**
 * Errors thrown by the attestation service. Mapped to HTTP status codes by the
 * service layer; the controller never exposes the error message text — only an
 * opaque `{ code: errorId }` envelope — so detail strings here are for logs.
 */
export class PasskeyAttestationError extends Error {
  public constructor(
    public readonly errorId: PasskeyAttestationErrorId,
    message?: string,
  ) {
    super(message ?? errorId);
    this.name = 'PasskeyAttestationError';
  }
}

export type PasskeyAttestationErrorId =
  | 'PASSKEY_NOT_CREATE_TYPE'
  | 'PASSKEY_RPID_NOT_ALLOWED'
  | 'PASSKEY_ORIGIN_NOT_ALLOWED'
  | 'PASSKEY_MALFORMED_ATTESTATION'
  | 'PASSKEY_UNSUPPORTED_KEY'
  | 'PASSKEY_RPID_MISMATCH'
  | 'PASSKEY_ATTESTATION_INVALID'
  | 'PASSKEY_VERIFICATION_TIMEOUT'
  | 'PASSKEY_CHALLENGE_INVALID';

export interface VerifyAttestationInput {
  rpId: string;
  origin: string;
  attestationObject: string; // base64url
  clientDataJSON: string; // base64url
  challenge: string; // base64url; client-supplied, server-recomputable
  /**
   * Recomputes the expected challenge for this request. The verifier uses a
   * constant-time comparison against the WebAuthn `challenge` from
   * clientDataJSON. Returning `null` (or throwing) signals that no
   * server-recomputable challenge can be derived for this input.
   */
  expectedChallenge: () => string;
}

export interface VerifiedPasskey {
  /** 32-byte big-endian P-256 X coordinate. */
  x: Buffer;
  /** 32-byte big-endian P-256 Y coordinate. */
  y: Buffer;
  /** Raw credentialId bytes recovered from the verified attestation. */
  credentialId: Buffer;
  /** RP ID confirmed by the library against authData.rpIdHash. */
  rpId: string;
  alg: number;
}

@Injectable()
export class PasskeyAttestationService {
  private readonly verificationTimeoutMs: number;

  public constructor(
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
  ) {
    this.verificationTimeoutMs = configurationService.getOrThrow<number>(
      'passkeys.verificationTimeoutMs',
    );
  }

  public async verify(
    input: VerifyAttestationInput,
    rpIdAllowlist: ReadonlyArray<string>,
    originAllowlist: ReadonlyArray<string>,
  ): Promise<VerifiedPasskey> {
    if (!rpIdAllowlist.includes(input.rpId)) {
      throw new PasskeyAttestationError('PASSKEY_RPID_NOT_ALLOWED');
    }
    if (!originAllowlist.includes(input.origin)) {
      throw new PasskeyAttestationError('PASSKEY_ORIGIN_NOT_ALLOWED');
    }

    // clientDataJSON.type must be 'webauthn.create' for a registration ceremony.
    // We surface a tighter errorId for assertion-shaped requests (webauthn.get)
    // before handing off to the library.
    const clientData = parseClientDataJSON(input.clientDataJSON);
    if (clientData.type !== 'webauthn.create') {
      throw new PasskeyAttestationError('PASSKEY_NOT_CREATE_TYPE');
    }

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
    ).catch(mapLibraryError);

    if (!verification.verified) {
      throw new PasskeyAttestationError('PASSKEY_ATTESTATION_INVALID');
    }
    const info = verification.registrationInfo;

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
    if (!xRaw || !yRaw) {
      throw new PasskeyAttestationError('PASSKEY_UNSUPPORTED_KEY');
    }

    return {
      x: pad32(xRaw),
      y: pad32(yRaw),
      credentialId: Buffer.from(info.credential.id),
      rpId: info.rpID ?? input.rpId,
      alg,
    };
  }

  private async runWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(new PasskeyAttestationError('PASSKEY_VERIFICATION_TIMEOUT')),
        this.verificationTimeoutMs,
      );
    });
    try {
      return await Promise.race([fn(), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function parseClientDataJSON(b64url: string): { type?: string } {
  try {
    const raw = Buffer.from(b64url, 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as { type?: string };
    }
    throw new Error('clientDataJSON did not decode to an object');
  } catch {
    throw new PasskeyAttestationError('PASSKEY_MALFORMED_ATTESTATION');
  }
}

function timingSafeEqualBase64Url(a: string, b: string): boolean {
  // Constant-time compare on the (typically equal-length) base64url strings.
  // If lengths differ we still touch both buffers via timingSafeEqual on a
  // padded copy to keep the comparison time independent of the mismatch index.
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) {
    const max = Math.max(ab.length, bb.length);
    const apad = Buffer.alloc(max);
    const bpad = Buffer.alloc(max);
    ab.copy(apad);
    bb.copy(bpad);
    timingSafeEqual(apad, bpad);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

function pad32(buf: Uint8Array): Buffer {
  if (buf.length > 32) {
    throw new PasskeyAttestationError('PASSKEY_UNSUPPORTED_KEY');
  }
  if (buf.length === 32) return Buffer.from(buf);
  const out = Buffer.alloc(32);
  out.set(buf, 32 - buf.length);
  return out;
}

function mapLibraryError(err: unknown): never {
  if (err instanceof PasskeyAttestationError) throw err;
  // CBOR / COSE / base64 decoding inside the library generally surfaces as a
  // SyntaxError or generic Error. Treat all of these as malformed input — we
  // never echo the underlying message back to the client.
  throw new PasskeyAttestationError('PASSKEY_MALFORMED_ATTESTATION');
}
