// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { SurveySlugSchema } from '@/modules/surveys/domain/entities/survey.entity';
import {
  SubmitSurveyResponseDto,
  SubmitSurveyResponseDtoSchema,
  SurveyResponseResultDto,
} from '@/modules/surveys/routes/entities/submit-survey-response.dto.entity';
import { SurveyStateDto } from '@/modules/surveys/routes/entities/survey-state.dto.entity';
import { SurveysService } from '@/modules/surveys/routes/surveys.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

@ApiTags('surveys')
@Controller({ path: 'spaces', version: '1' })
export class SurveysController {
  constructor(
    @Inject(SurveysService)
    private readonly surveysService: SurveysService,
  ) {}

  @ApiOperation({
    summary: 'Get survey state for a space',
    description:
      "Returns the active survey definition and this space's response (if any) in a single round trip. Only active admins of the space can read survey state.",
  })
  @ApiParam({ name: 'spaceId', type: 'number', example: 1 })
  @ApiParam({ name: 'slug', type: 'string', example: 'onboarding' })
  @ApiOkResponse({ type: SurveyStateDto })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({
    description: 'User is not an active admin of this space',
  })
  @ApiNotFoundResponse({ description: 'No active survey for this slug' })
  @Get('/:spaceId/surveys/:slug/state')
  @UseGuards(AuthGuard)
  public async getState(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
    @Param('slug', new ValidationPipe(SurveySlugSchema)) slug: string,
  ): Promise<SurveyStateDto> {
    return await this.surveysService.getState({
      authPayload,
      spaceId,
      slug,
    });
  }

  @ApiOperation({
    summary: 'Submit a survey response for a space',
    description:
      "Submits or updates the space's response to the active survey for the given slug. Only active admins of the space can submit. Idempotent: repeat submissions overwrite the previous response.",
  })
  @ApiParam({ name: 'spaceId', type: 'number', example: 1 })
  @ApiParam({ name: 'slug', type: 'string', example: 'onboarding' })
  @ApiBody({ type: SubmitSurveyResponseDto })
  @ApiCreatedResponse({ type: SurveyResponseResultDto })
  @ApiBadRequestResponse({
    description: 'Empty selections or unknown option keys',
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({
    description: 'User is not an active admin of this space',
  })
  @ApiNotFoundResponse({ description: 'No active survey for this slug' })
  @Post('/:spaceId/surveys/:slug/responses')
  @UseGuards(AuthGuard)
  public async submitResponse(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
    @Param('slug', new ValidationPipe(SurveySlugSchema)) slug: string,
    @Body(new ValidationPipe(SubmitSurveyResponseDtoSchema))
    body: SubmitSurveyResponseDto,
  ): Promise<SurveyResponseResultDto> {
    return await this.surveysService.submitResponse({
      authPayload,
      spaceId,
      slug,
      body,
    });
  }
}
