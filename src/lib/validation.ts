import { z } from "zod";

export const countrySchema = z.object({
  name: z.string().min(2).max(100),
  isoCode: z
    .string()
    .length(2)
    .transform((val) => val.toUpperCase()),
  regionIdentifier: z.string().min(2).max(20),
  sourceUrl: z.string().url().optional().or(z.literal(""))
});

export const refreshSchema = z.object({
  all: z.boolean().optional(),
  force: z.boolean().optional(),
  countryId: z.number().int().positive().optional(),
  isoCode: z
    .string()
    .length(2)
    .transform((val) => val.toUpperCase())
    .optional()
});
