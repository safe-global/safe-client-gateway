// SPDX-License-Identifier: FSL-1.1-MIT
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSurveys1779100947599 implements MigrationInterface {
  name = 'CreateSurveys1779100947599';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "surveys" (
        "id" SERIAL NOT NULL,
        "slug" character varying(64) NOT NULL,
        "version" integer NOT NULL,
        "title" character varying(255) NOT NULL,
        "subtitle" character varying(255),
        "survey_content" jsonb NOT NULL,
        "is_active" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_surveys_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_surveys_slug_version" UNIQUE ("slug", "version")
      )
    `);
    // UNIQUE so an operator can't accidentally leave two versions of the same
    // slug active at once (kill-switch flips depend on this invariant).
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_surveys_active" ON "surveys" ("slug") WHERE "is_active" = true`,
    );

    await queryRunner.query(`
      CREATE TABLE "survey_responses" (
        "id" SERIAL NOT NULL,
        "space_id" integer NOT NULL,
        "survey_id" integer NOT NULL,
        "answered_by_user_id" integer,
        "selections" jsonb NOT NULL,
        "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_survey_responses_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_survey_responses_space_survey" UNIQUE ("space_id", "survey_id"),
        CONSTRAINT "FK_survey_responses_space_id" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_survey_responses_survey_id" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_survey_responses_answered_by_user_id" FOREIGN KEY ("answered_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_survey_responses_survey" ON "survey_responses" ("survey_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_survey_responses_selections" ON "survey_responses" USING GIN ("selections")`,
    );

    // Match the convention used by every other timestamped table in this repo:
    // a BEFORE-UPDATE trigger that bumps updated_at on every row update,
    // independent of whether the writer remembered to set it explicitly.
    await queryRunner.query(
      `CREATE TRIGGER update_updated_at
        BEFORE UPDATE ON survey_responses
        FOR EACH ROW EXECUTE PROCEDURE update_updated_at();`,
    );

    // Seed onboarding v1. survey.title / survey.subtitle are admin-facing metadata
    // (used as the Mixpanel event label, future admin UI, etc.). The user-facing
    // headers live on the page itself.
    await queryRunner.query(`
      INSERT INTO "surveys" ("slug", "version", "title", "subtitle", "survey_content", "is_active")
      VALUES (
        'onboarding',
        1,
        'Space Onboarding Survey',
        'Per-Space onboarding questionnaire',
        '{
          "pages": [
            {
              "id": "use_cases",
              "title": "How will you use Safe?",
              "subtitle": "Select all that apply. We''ll tailor your setup.",
              "multiSelect": true,
              "options": [
                {"key": "operate_protocol",  "label": "Operate a protocol",         "description": "Contract admin, upgrades, and governance.",   "icon": "terminal"},
                {"key": "distribute_tokens", "label": "Distribute tokens",          "description": "Vesting schedules, grants, and incentives.",  "icon": "gift"},
                {"key": "run_payments",      "label": "Run payments",               "description": "Payroll, vendors, and recurring payouts.",    "icon": "cash"},
                {"key": "earn_yield",        "label": "Earn yield",                 "description": "Stake, lend, and run DeFi strategies.",       "icon": "sprout"},
                {"key": "trade_liquidity",   "label": "Trade and provide liquidity","description": "Frequent swaps and market-making.",           "icon": "swap"},
                {"key": "hold_assets",       "label": "Hold assets",                "description": "Long-term custody with minimal movement.",    "icon": "bank"}
              ]
            }
          ]
        }'::jsonb,
        true
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "survey_responses"`);
    await queryRunner.query(`DROP TABLE "surveys"`);
  }
}
