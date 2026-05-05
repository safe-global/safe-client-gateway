// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { PasskeyRecordResponse } from '@/modules/passkeys/routes/entities/passkey-record.dto.entity';
import {
  RegisterPasskeyDtoEntity,
  RegisterPasskeySchema,
} from '@/modules/passkeys/routes/entities/register-passkey.dto.entity';
import { PasskeysService } from '@/modules/passkeys/routes/passkeys.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

/**
 * The POST endpoint deliberately deviates from CGW's "@ApiOkResponse on POST"
 * convention: the RFC mandates the 201 (created) vs 200 (idempotent re-POST)
 * distinction so clients can show "already registered" without an extra call.
 */
@ApiTags('passkeys')
@Controller({ path: 'passkeys', version: '1' })
export class PasskeysController {
  public constructor(private readonly passkeysService: PasskeysService) {}

  @ApiOperation({
    summary: 'Register a passkey',
    description:
      'Verifies a WebAuthn attestation and stores the derived (x, y) public-key coordinates against the credentialId. Idempotent: re-POSTing the same record returns 200; mismatching coordinates or a different rpId returns 409.',
  })
  @ApiBody({ type: RegisterPasskeyDtoEntity })
  @ApiCreatedResponse({
    description: 'Passkey coordinates stored.',
    type: PasskeyRecordResponse,
  })
  @ApiOkResponse({
    description: 'Identical record already exists (idempotent re-POST).',
    type: PasskeyRecordResponse,
  })
  @ApiBadRequestResponse({
    description:
      'Malformed input, unsupported COSE key, RP-ID mismatch, or non-create clientDataJSON.',
  })
  @ApiForbiddenResponse({
    description:
      'rpId, origin, or verifiers value is not in the configured allowlist.',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Attestation signature did not verify.',
  })
  @ApiConflictResponse({
    description:
      'A different record already exists for this credentialId (PASSKEY_CONFLICT or PASSKEY_CROSS_RP_CONFLICT).',
  })
  @ApiTooManyRequestsResponse({ description: 'Per-IP rate limit exceeded.' })
  @ApiServiceUnavailableResponse({
    description:
      'Attestation verification timed out (slow cert-chain validation).',
  })
  @Post()
  // Default 201; the service may downgrade to 200 for idempotent re-POST.
  @HttpCode(HttpStatus.CREATED)
  public async register(
    @Body(new ValidationPipe(RegisterPasskeySchema, HttpStatus.BAD_REQUEST))
    dto: import('@/modules/passkeys/routes/entities/register-passkey.dto.entity').RegisterPasskeyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PasskeyRecordResponse> {
    const outcome = await this.passkeysService.register(dto);
    res.status(outcome.status);
    return outcome.body;
  }
}
