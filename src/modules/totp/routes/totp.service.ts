// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as OTPAuth from 'otpauth';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import { TotpRepository } from '@/modules/totp/datasources/totp.repository';

export type TotpStatus = 'NONE' | 'ACTIVE';

@Injectable()
export class TotpService {
  private readonly issuer: string;
  private readonly elevationWindowSeconds: number;

  public constructor(
    private readonly totpRepository: TotpRepository,
    @Inject(IAuthRepository)
    private readonly authRepository: IAuthRepository,
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
  ) {
    this.issuer = configurationService.getOrThrow<string>('auth.totp.issuer');
    this.elevationWindowSeconds = configurationService.getOrThrow<number>(
      'auth.totp.elevationWindowSeconds',
    );
  }

  /**
   * Generates a fresh secret, stores it for the user, and returns the
   * provisioning URI (for the QR code) and the secret (for manual entry).
   * The presence of the stored secret means the user is enrolled.
   */
  public async startRegistration(
    userId: number,
    label: string,
  ): Promise<{ uri: string; secret: string }> {
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = this.buildTotp(secret, label);
    // Rejects with 409 if the user is already enrolled (enforced by the
    // primary key), so a stolen session can't re-enroll a new secret.
    await this.totpRepository.insertSecret(userId, secret.base32);
    return { uri: totp.toString(), secret: secret.base32 };
  }

  /**
   * Validates a code against the user's stored secret and, on success, mints a
   * short-lived elevation token. Throws if the user isn't enrolled or the code
   * is wrong.
   */
  public async verifyCode(
    userId: number,
    code: string,
  ): Promise<{ token: string; maxAgeMs: number }> {
    const storedSecret = await this.totpRepository.getSecret(userId);
    if (!storedSecret) {
      throw new UnauthorizedException('TOTP is not set up');
    }

    const totp = this.buildTotp(OTPAuth.Secret.fromBase32(storedSecret));
    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    const maxAgeMs = this.elevationWindowSeconds * 1_000;
    const token = this.authRepository.signTotpElevationToken({
      userId: String(userId),
      exp: new Date(Date.now() + maxAgeMs),
    });
    return { token, maxAgeMs };
  }

  public async getStatus(userId: number): Promise<TotpStatus> {
    const storedSecret = await this.totpRepository.getSecret(userId);
    return storedSecret ? 'ACTIVE' : 'NONE';
  }

  // `label` only affects the otpauth:// URI shown at enrollment (the account
  // name in the authenticator app); it has no bearing on code verification, so
  // it defaults to empty for the verify path.
  private buildTotp(secret: OTPAuth.Secret, label = ''): OTPAuth.TOTP {
    return new OTPAuth.TOTP({
      issuer: this.issuer,
      label,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });
  }
}
