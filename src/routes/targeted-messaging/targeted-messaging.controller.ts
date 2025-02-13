import { TargetedSafeSchema } from '@/domain/targeted-messaging/entities/targeted-safe.entity';
import { TargetedSafeNotFoundError } from '@/domain/targeted-messaging/errors/targeted-safe-not-found.error';
import {
  CreateSubmissionDto,
  CreateSubmissionDtoSchema,
} from '@/routes/targeted-messaging/entities/create-submission.dto.entity';
import { Submission } from '@/routes/targeted-messaging/entities/submission.entity';
import { TargetedSafe } from '@/routes/targeted-messaging/entities/targeted-safe.entity';
import { TargetedMessagingService } from '@/routes/targeted-messaging/targeted-messaging.service';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
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
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';

@ApiTags('targeted-messaging')
@Controller({
  path: 'targeted-messaging/outreaches',
  version: '1',
})
export class TargetedMessagingController {
  constructor(private readonly service: TargetedMessagingService) {}

  @ApiOkResponse({ type: TargetedSafe })
  @ApiNotFoundResponse({ description: 'Safe not targeted.' })
  @Get(':outreachId/chains/:chainId/safes/:safeAddress')
  async getTargetedSafe(
    @Param(
      'outreachId',
      ParseIntPipe,
      new ValidationPipe(TargetedSafeSchema.shape.outreachId),
    )
    outreachId: number,
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
  ): Promise<TargetedSafe> {
    return this.service.getTargetedSafe({ outreachId, chainId, safeAddress });
  }

  @ApiOkResponse({ type: Submission })
  @Get(
    ':outreachId/chains/:chainId/safes/:safeAddress/signers/:signerAddress/submissions',
  )
  async getSubmission(
    @Res() res: Response,
    @Param('outreachId', ParseIntPipe)
    outreachId: number,
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Param('signerAddress', new ValidationPipe(AddressSchema))
    signerAddress: `0x${string}`,
  ): Promise<Response> {
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
        .json(submission);
    } catch (err) {
      if (err instanceof TargetedSafeNotFoundError) {
        return res
          .status(HttpStatus.NO_CONTENT)
          .header('Cache-Control', 'no-cache')
          .json({});
      }
      throw err;
    }
  }

  @ApiCreatedResponse({ type: Submission })
  @Post(
    ':outreachId/chains/:chainId/safes/:safeAddress/signers/:signerAddress/submissions',
  )
  async createSubmission(
    @Param('outreachId', ParseIntPipe)
    outreachId: number,
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Param('signerAddress', new ValidationPipe(AddressSchema))
    signerAddress: `0x${string}`,
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
