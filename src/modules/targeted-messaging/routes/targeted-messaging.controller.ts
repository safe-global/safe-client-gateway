// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import type { Address } from 'viem';
import { TargetedSafeSchema } from '@/modules/targeted-messaging/domain/entities/targeted-safe.entity';
import { TargetedSafeNotFoundError } from '@/modules/targeted-messaging/domain/errors/targeted-safe-not-found.error';
import {
  CreateSubmissionDto,
  CreateSubmissionDtoSchema,
} from '@/modules/targeted-messaging/routes/entities/create-submission.dto.entity';
import { Submission } from '@/modules/targeted-messaging/routes/entities/submission.entity';
import { TargetedSafe } from '@/modules/targeted-messaging/routes/entities/targeted-safe.entity';
import { TargetedMessagingService } from '@/modules/targeted-messaging/routes/targeted-messaging.service';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

@ApiTags('targeted-messaging')
@Controller({
  path: 'targeted-messaging/outreaches',
  version: '1',
})
export class TargetedMessagingController {
  constructor(private readonly service: TargetedMessagingService) {}

  @ApiOkResponse({ type: TargetedSafe })
  @ApiNoContentResponse({ description: 'Safe not targeted.' })
  @Get(':outreachId/chains/:chainId/safes/:safeAddress')
  async getTargetedSafe(
    @Res() res: FastifyReply,
    @Param(
      'outreachId',
      ParseIntPipe,
      new ValidationPipe(TargetedSafeSchema.shape.outreachId),
    )
    outreachId: number,
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
  ): Promise<FastifyReply> {
    try {
      const targetedSafe = await this.service.getTargetedSafe({
        outreachId,
        chainId,
        safeAddress,
      });
      return res
        .status(HttpStatus.OK)
        .header('Cache-Control', 'no-cache')
        .send(targetedSafe);
    } catch (err) {
      if (err instanceof TargetedSafeNotFoundError) {
        // "Safe not targeted" is the expected answer for nearly every Safe,
        // and clients probe this route on every Safe load. Answering 404 made
        // browsers write an unsuppressible console error for a non-failure —
        // the noise WA-2991 exists to remove. 204 carries the same "no
        // targeting for this Safe" answer as the sibling submissions route
        // below, which already maps this error that way.
        //
        // `Cache-Control` is set explicitly on both paths: `@Res()` marks the
        // reply sent, so CacheControlInterceptor skips it (same reason
        // getSubmission sets it by hand).
        return res
          .status(HttpStatus.NO_CONTENT)
          .header('Cache-Control', 'no-cache')
          .send();
      }
      throw err;
    }
  }

  @ApiOkResponse({ type: Submission })
  @Get(
    ':outreachId/chains/:chainId/safes/:safeAddress/signers/:signerAddress/submissions',
  )
  async getSubmission(
    @Res() res: FastifyReply,
    @Param('outreachId', ParseIntPipe)
    outreachId: number,
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Param('signerAddress', new ValidationPipe(AddressSchema))
    signerAddress: Address,
  ): Promise<FastifyReply> {
    try {
      const submission = await this.service.getSubmission({
        outreachId,
        chainId,
        safeAddress,
        signerAddress,
      });
      return res
        .status(HttpStatus.OK)
        .header('Cache-Control', 'no-cache')
        .send(submission);
    } catch (err) {
      if (err instanceof TargetedSafeNotFoundError) {
        // 204 responses carry no body; Fastify strips any payload, so send
        // none rather than a misleading empty object.
        return res
          .status(HttpStatus.NO_CONTENT)
          .header('Cache-Control', 'no-cache')
          .send();
      }
      throw err;
    }
  }

  @ApiBody({ type: CreateSubmissionDto })
  @ApiCreatedResponse({ type: Submission })
  @Post(
    ':outreachId/chains/:chainId/safes/:safeAddress/signers/:signerAddress/submissions',
  )
  async createSubmission(
    @Param('outreachId', ParseIntPipe)
    outreachId: number,
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: Address,
    @Param('signerAddress', new ValidationPipe(AddressSchema))
    signerAddress: Address,
    @Body(new ValidationPipe(CreateSubmissionDtoSchema))
    createSubmissionDto: CreateSubmissionDto,
  ): Promise<Submission> {
    try {
      return await this.service.createSubmission({
        outreachId,
        chainId,
        safeAddress,
        signerAddress,
        createSubmissionDto,
      });
    } catch (err) {
      if (err instanceof TargetedSafeNotFoundError) {
        throw new NotFoundException('Targeted Safe not found');
      }
      throw err;
    }
  }
}
