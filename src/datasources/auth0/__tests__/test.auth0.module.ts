// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { IAuth0Service } from '@/datasources/auth0/auth0.service.interface';

export const mockAuth0Service: jest.MockedObjectDeep<IAuth0Service> =
  jest.mocked({
    verifyAndDecode: jest.fn(),
  });

@Module({
  providers: [{ provide: IAuth0Service, useValue: mockAuth0Service }],
  exports: [IAuth0Service],
})
export class TestAuth0Module {}
