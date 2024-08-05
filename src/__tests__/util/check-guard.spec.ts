import 'reflect-metadata';
import { checkGuardIsApplied } from './check-guard';
import { Controller, Get, UseGuards } from '@nestjs/common';

class TestGuard {}
class AnotherGuard {}

@Controller('test')
export class TestController {
  @Get('guarded')
  @UseGuards(TestGuard)
  getWithGuard(): string {
    return 'test';
  }
  @Get('unguarded')
  getWithoutGuard(): string {
    return 'test';
  }
}

describe('checkGuardIsApplied', () => {
  it('should verify that the specified guard is applied to the controller function', () => {
    checkGuardIsApplied(TestGuard, TestController.prototype.getWithGuard);
  });

  it('should throw an error if the guard is not applied to the controller function', () => {
    expect(() =>
      checkGuardIsApplied(TestGuard, TestController.prototype.getWithoutGuard),
    ).toThrow();
  });

  it('should throw an error if the guard name does not match', () => {
    expect(() =>
      checkGuardIsApplied(AnotherGuard, TestController.prototype.getWithGuard),
    ).toThrow();
  });
});
