import { Module } from '@nestjs/common';
import { IAuth0Service } from '@/datasources/auth0/auth0.service.interface';
import type { Auth0Token } from '@/datasources/auth0/entities/auth0-token.entity';

export const mockAuth0Service: jest.MockedObjectDeep<IAuth0Service> =
  jest.mocked({
    verifyAndDecode: jest.fn<Auth0Token, [string]>(),
  });

@Module({
  providers: [{ provide: IAuth0Service, useValue: mockAuth0Service }],
  exports: [IAuth0Service],
})
export class TestAuth0Module {}
