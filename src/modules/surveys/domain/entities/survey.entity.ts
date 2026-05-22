// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

// URL-safe identifier shared between the DB column and the :slug path param.
export const SurveySlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_-]+$/);

export const SurveyOptionSchema = z.object({
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  icon: z.string().min(1).max(64).optional(),
});
export type SurveyOption = z.infer<typeof SurveyOptionSchema>;

export const SurveyPageSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(255),
  subtitle: z.string().min(1).max(255).nullable(),
  multiSelect: z.boolean(),
  options: z.array(SurveyOptionSchema).min(1).max(64),
});
export type SurveyPage = z.infer<typeof SurveyPageSchema>;

export const SurveyContentSchema = z.object({
  pages: z.array(SurveyPageSchema).min(1).max(20),
});
export type SurveyContent = z.infer<typeof SurveyContentSchema>;

export const SurveySchema = z.object({
  id: z.number().int(),
  slug: SurveySlugSchema,
  version: z.number().int().positive(),
  title: z.string().min(1).max(255),
  subtitle: z.string().min(1).max(255).nullable(),
  surveyContent: SurveyContentSchema,
  isActive: z.boolean(),
  createdAt: z.date(),
});
export type Survey = z.infer<typeof SurveySchema>;
