import { CreateAccountDtoSchema } from '@/domain/accounts/entities/create-account.dto.entity';
import { UpsertAccountDataSettingsDtoSchema } from '@/domain/accounts/entities/upsert-account-data-settings.dto.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { AccountsService } from '@/routes/accounts/accounts.service';
import { AccountDataSetting } from '@/routes/accounts/entities/account-data-setting.entity';
import { AccountDataType } from '@/routes/accounts/entities/account-data-type.entity';
import { Account } from '@/routes/accounts/entities/account.entity';
import { CreateAccountDto } from '@/routes/accounts/entities/create-account.dto.entity';
import { UpsertAccountDataSettingsDto } from '@/routes/accounts/entities/upsert-account-data-settings.dto.entity';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { Request } from 'express';

@ApiTags('accounts')
@Controller({ path: 'accounts', version: '1' })
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @ApiOperation({
    summary: 'Create account',
    description:
      'Creates a new account for the authenticated user. The account is associated with the signer address from the authentication payload.',
  })
  @ApiBody({
    type: CreateAccountDto,
    description:
      'Account creation data including name and other optional settings',
  })
  @ApiCreatedResponse({
    type: Account,
    description: 'Account created successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @ApiForbiddenResponse({
    description: 'Access forbidden - insufficient permissions',
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard)
  async createAccount(
    @Body(new ValidationPipe(CreateAccountDtoSchema))
    createAccountDto: CreateAccountDto,
    @Auth() authPayload: AuthPayload,
    @Req() req: Request,
  ): Promise<Account> {
    return this.accountsService.createAccount({
      authPayload,
      createAccountDto,
      clientIp: req.ip,
    });
  }

  @ApiOperation({
    summary: 'Get account data types',
    description:
      'Retrieves all available account data types that can be used when configuring account data settings.',
  })
  @ApiOkResponse({
    type: AccountDataType,
    isArray: true,
    description: 'List of available account data types',
  })
  @Get('data-types')
  async getDataTypes(): Promise<Array<AccountDataType>> {
    return this.accountsService.getDataTypes();
  }

  @ApiOperation({
    summary: 'Get account data settings',
    description:
      'Retrieves data settings for a specific account address. Returns the configured data types and their settings for the authenticated user.',
  })
  @ApiParam({
    name: 'address',
    type: 'string',
    description: 'The account address (0x prefixed hex string)',
  })
  @ApiOkResponse({
    type: AccountDataSetting,
    isArray: true,
    description: 'List of account data settings for the specified address',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @Get(':address/data-settings')
  @UseGuards(AuthGuard)
  async getAccountDataSettings(
    @Auth() authPayload: AuthPayload,
    @Param('address', new ValidationPipe(AddressSchema)) address: `0x${string}`,
  ): Promise<Array<AccountDataSetting>> {
    return this.accountsService.getAccountDataSettings({
      authPayload,
      address,
    });
  }

  @ApiOperation({
    summary: 'Update account data settings',
    description:
      'Creates or updates data settings for a specific account address. This endpoint allows configuring which data types are enabled for the account.',
  })
  @ApiParam({
    name: 'address',
    type: 'string',
    description: 'The account address (0x prefixed hex string)',
  })
  @ApiBody({
    type: UpsertAccountDataSettingsDto,
    description: 'Data settings to create or update for the account',
  })
  @ApiOkResponse({
    type: AccountDataSetting,
    isArray: true,
    description: 'Updated account data settings',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @Put(':address/data-settings')
  @UseGuards(AuthGuard)
  async upsertAccountDataSettings(
    @Auth() authPayload: AuthPayload,
    @Param('address', new ValidationPipe(AddressSchema)) address: `0x${string}`,
    @Body(new ValidationPipe(UpsertAccountDataSettingsDtoSchema))
    upsertAccountDataSettingsDto: UpsertAccountDataSettingsDto,
  ): Promise<Array<AccountDataSetting>> {
    return this.accountsService.upsertAccountDataSettings({
      authPayload,
      address,
      upsertAccountDataSettingsDto,
    });
  }

  @ApiOperation({
    summary: 'Get account by address',
    description:
      'Retrieves account information for a specific address. The account must belong to the authenticated user.',
  })
  @ApiParam({
    name: 'address',
    type: 'string',
    description: 'The account address (0x prefixed hex string)',
  })
  @ApiOkResponse({
    type: Account,
    description: 'Account information retrieved successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @Get(':address')
  @UseGuards(AuthGuard)
  async getAccount(
    @Param('address', new ValidationPipe(AddressSchema)) address: `0x${string}`,
    @Auth() authPayload: AuthPayload,
  ): Promise<Account> {
    return this.accountsService.getAccount({ authPayload, address });
  }

  @ApiOperation({
    summary: 'Delete account',
    description:
      'Deletes an account and all its associated data for the specified address. The account must belong to the authenticated user.',
  })
  @ApiParam({
    name: 'address',
    type: 'string',
    description: 'The account address to delete (0x prefixed hex string)',
  })
  @ApiNoContentResponse({
    description: 'Account deleted successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @Delete(':address')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @Param('address', new ValidationPipe(AddressSchema)) address: `0x${string}`,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    return this.accountsService.deleteAccount({ authPayload, address });
  }
}
