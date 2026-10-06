// SPDX-License-Identifier: FSL-1.1-MIT

import { z } from 'zod';

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;
const HTTP_METHODS = ['GET', ...WRITE_METHODS] as const;

// Absolute path with no empty, `.` or `..` segment and no percent-encoding, so
// the path that is matched against the API document is the path that is routed.
const GatewayPathSchema = z
  .string()
  .max(512)
  .regex(
    /^(?:\/(?!\.{1,2}(?:\/|$))[\w\-.:~]+)+$/,
    'Must be an absolute gateway path such as /v1/spaces/1 without query string',
  );

const QueryValueSchema = z.union([z.string(), z.number(), z.boolean()]);

const QuerySchema = z
  .record(z.string(), z.union([QueryValueSchema, z.array(QueryValueSchema)]))
  .optional()
  .describe('Query string parameters');

export const SearchEndpointsArgumentsSchema = z.object({
  query: z
    .string()
    .max(200)
    .optional()
    .describe(
      'Words to look for in the path, summary, tags or operation id. Omit to list every endpoint.',
    ),
});

export const DescribeEndpointArgumentsSchema = z.object({
  method: z.enum(HTTP_METHODS),
  path: z
    .string()
    .max(512)
    .describe(
      'Path template as returned by search_endpoints, e.g. /v1/spaces/{id}',
    ),
});

export const ReadEndpointArgumentsSchema = z.object({
  path: GatewayPathSchema.describe(
    'Path with every parameter filled in, e.g. /v1/spaces/12/members',
  ),
  query: QuerySchema,
});

export const WriteEndpointArgumentsSchema = z.object({
  method: z.enum(WRITE_METHODS),
  path: GatewayPathSchema.describe(
    'Path with every parameter filled in, e.g. /v1/spaces/12/members/invite',
  ),
  query: QuerySchema,
  body: z.unknown().optional().describe('JSON request body'),
});

export type HttpMethod = (typeof HTTP_METHODS)[number];
export type GatewayQuery = z.infer<typeof QuerySchema>;
