// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
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
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { LegacySpaceIdPipe } from '@/modules/spaces/routes/pipes/space-id.pipe';
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
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description:
      'Space UUID to get survey state for (numeric ID accepted for legacy clients, deprecated)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
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
    @Param('spaceId', LegacySpaceIdPipe) spaceId: number,
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
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID to submit a survey response for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
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
    @Param('spaceId', LegacySpaceIdPipe) spaceId: number,
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
