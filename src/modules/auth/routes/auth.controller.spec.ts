// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { AuthController } from '@/modules/auth/routes/auth.controller';
import type { AuthService } from '@/modules/auth/routes/auth.service';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import {
  oidcAuthPayloadDtoBuilder,
  siweAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import type { UserSession } from '@/modules/auth/routes/entities/user-session.entity';

const authService = {
  getUserSession: jest.fn(),
  getNonce: jest.fn(),
  authenticateWithSiwe: jest.fn(),
  getTokenPayloadWithClaims: jest.fn(),
  getLogoutRedirectUrl: jest.fn(),
} as jest.MockedObjectDeep<AuthService>;

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(() => {
    jest.resetAllMocks();

    const configurationService = new FakeConfigurationService();
    configurationService.set('application.isProduction', true);

    controller = new AuthController(configurationService, authService);
  });

  describe('getMe', () => {
    it('should delegate SIWE session lookup to the service', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const userSession: UserSession = {
        id: authPayload.sub!,
        authMethod: authPayload.auth_method!,
        signerAddress: authPayload.signer_address,
      };
      authService.getUserSession.mockResolvedValue(userSession);

      const result = await controller.getMe(authPayload);

      expect(authService.getUserSession).toHaveBeenCalledWith(authPayload);
      expect(result).toBe(userSession);
    });

    it('should return OIDC email from the service result', async () => {
      const authPayload = new AuthPayload(oidcAuthPayloadDtoBuilder().build());
      const userSession: UserSession = {
        id: authPayload.sub!,
        authMethod: authPayload.auth_method!,
        email: faker.internet.email().toLowerCase(),
      };
      authService.getUserSession.mockResolvedValue(userSession);

      const result = await controller.getMe(authPayload);

      expect(authService.getUserSession).toHaveBeenCalledWith(authPayload);
      expect(result).toBe(userSession);
    });
  });
});
