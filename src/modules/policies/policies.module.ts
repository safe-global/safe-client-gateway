// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from "@nestjs/common";
import { HttpErrorFactory } from "@/datasources/errors/http-error-factory";
import { PolicyIndexerApi } from "@/modules/policies/datasources/policy-indexer-api.service";
import { PolicyIndexerRepository } from "@/modules/policies/domain/policy-indexer.repository";
import { IPolicyIndexerRepository } from "@/modules/policies/domain/policy-indexer.repository.interface";

/**
 * A policy reaches a Safe through one of three mechanisms - an enabled module,
 * the `SafePolicyGuard`, or an off-chain logic.
 */
@Module({
  providers: [
    HttpErrorFactory,
    PolicyIndexerApi,
    { provide: IPolicyIndexerRepository, useClass: PolicyIndexerRepository },
  ],
  exports: [IPolicyIndexerRepository],
})
export class PoliciesModule {}
