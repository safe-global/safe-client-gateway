// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { PasskeyErrorResponse } from '@/modules/passkeys/routes/entities/passkey-error.dto.entity';
import { PasskeyRecordResponse } from '@/modules/passkeys/routes/entities/passkey-record.dto.entity';
import {
  type RegisterPasskeyDto,
  RegisterPasskeyDtoEntity,
  RegisterPasskeySchema,
} from '@/modules/passkeys/routes/entities/register-passkey.dto.entity';
import { PasskeysLookupRateLimitGuard } from '@/modules/passkeys/routes/guards/passkeys-lookup-rate-limit.guard';
import { PasskeysRegistrationRateLimitGuard } from '@/modules/passkeys/routes/guards/passkeys-registration-rate-limit.guard';
import { PasskeysLookupCacheInterceptor } from '@/modules/passkeys/routes/interceptors/passkeys-lookup-cache.interceptor';
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
    type: PasskeyErrorResponse,
  })
  @ApiForbiddenResponse({
    description: 'rpId or origin is not in the configured allowlist.',
    type: PasskeyErrorResponse,
  })
  @ApiUnprocessableEntityResponse({
    description: 'Attestation signature did not verify.',
    type: PasskeyErrorResponse,
  })
  @ApiConflictResponse({
    description:
      'A different record already exists for this credentialId (PASSKEY_CONFLICT or PASSKEY_CROSS_RP_CONFLICT).',
    type: PasskeyErrorResponse,
  })
  @ApiTooManyRequestsResponse({
    description: 'Per-IP rate limit exceeded.',
    type: PasskeyErrorResponse,
  })
  @ApiServiceUnavailableResponse({
    description:
      'Attestation verification timed out (slow cert-chain validation).',
    type: PasskeyErrorResponse,
  })
  @Post()
  @UseGuards(PasskeysRegistrationRateLimitGuard)
  // Default 201; the service may downgrade to 200 for idempotent re-POST.
  @HttpCode(HttpStatus.CREATED)
  public async register(
    @Body(new ValidationPipe(RegisterPasskeySchema, HttpStatus.BAD_REQUEST))
    dto: RegisterPasskeyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PasskeyRecordResponse> {
    const outcome = await this.passkeysService.register(dto);
    res.status(outcome.status);
    return outcome.body;
  }

  @ApiOperation({
    summary: 'Look up passkey coordinates',
    description:
      'Returns the canonical (x, y, verifiers, rpId) record for a credentialId. Rows are immutable, so successful responses are aggressively cacheable; misses return 404 with no-store to avoid stale-negative caching during first-launch flows.',
  })
  @ApiParam({
    name: 'credentialId',
    description:
      'WebAuthn credentialId, base64url-encoded (no padding). 1..1023 decoded bytes.',
  })
  @ApiOkResponse({
    type: PasskeyRecordResponse,
    headers: {
      'Cache-Control': {
        description:
          'public, max-age=86400, s-maxage=2592000, immutable — rows are immutable.',
        schema: { type: 'string' },
      },
      ETag: {
        description: 'First 16 bytes of credentialId as hex.',
        schema: { type: 'string' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Malformed credentialId.',
    type: PasskeyErrorResponse,
  })
  @ApiNotFoundResponse({
    description: 'No record for this credentialId.',
    type: PasskeyErrorResponse,
  })
  @ApiTooManyRequestsResponse({
    description: 'Per-IP rate limit exceeded.',
    type: PasskeyErrorResponse,
  })
  @Get(':credentialId')
  @UseGuards(PasskeysLookupRateLimitGuard)
  @UseInterceptors(PasskeysLookupCacheInterceptor)
  public async lookup(
    @Param('credentialId') credentialId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PasskeyRecordResponse> {
    const { body, etag } = await this.passkeysService.lookup(credentialId);
    res.setHeader('ETag', etag);
    res.setHeader('Vary', 'Accept-Encoding');
    return body;
  }
}
