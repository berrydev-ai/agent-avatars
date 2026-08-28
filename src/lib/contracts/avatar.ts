import { z } from 'zod';

const hashSchema = z.string().regex(/^[0-9a-f]{64}$/);
const idSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const avatarIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{20}$/);
const tagKeySchema = z
  .string()
  .regex(
    /^(expression|accessory|hair|eye|color|theme):[a-z0-9]+(?:-[a-z0-9]+)*$/,
  );
const httpsUrlSchema = z.string().url().startsWith('https://');

export const reviewRefSchema = z.object({
  system: z.enum(['multica', 'github', 'other']),
  id: z.string().min(1),
  url: httpsUrlSchema.optional(),
});

export const generatorDescriptorSchema = z.object({
  id: idSchema,
  adapterApiVersion: z.literal(1),
  name: z.string().min(1),
  kind: z.enum(['procedural', 'ai']),
  engine: z.string().min(1),
  engineVersion: z.string().min(1),
  components: z.record(z.string(), z.string()),
  sourceUrl: httpsUrlSchema,
  reproducibility: z.enum([
    'deterministic',
    'best-effort',
    'non-deterministic',
  ]),
  outputMediaTypes: z.array(
    z.enum(['image/svg+xml', 'image/png', 'image/webp', 'image/avif']),
  ),
});

export const rightsRecordSchema = z
  .object({
    id: idSchema,
    basis: z.enum(['spdx', 'provider-terms', 'owned']),
    name: z.string().min(1),
    spdxExpression: z.string().min(1).optional(),
    url: httpsUrlSchema,
    policyRevision: z.string().min(1),
    reviewedSourceSha256: hashSchema,
    attributionRequired: z.boolean(),
    attributionText: z.string().min(1).optional(),
    downloadAllowed: z.boolean(),
    redistributionAllowed: z.boolean(),
    commercialUseAllowed: z.boolean(),
    modificationsAllowed: z.boolean(),
    reviewedAt: z.string().date(),
    reviewBy: z.string().date().optional(),
  })
  .superRefine((rights, context) => {
    if (rights.basis === 'spdx' && !rights.spdxExpression) {
      context.addIssue({
        code: 'custom',
        message: 'SPDX rights require an SPDX expression.',
        path: ['spdxExpression'],
      });
    }
    if (rights.attributionRequired && !rights.attributionText) {
      context.addIssue({
        code: 'custom',
        message: 'Attribution text is required.',
        path: ['attributionText'],
      });
    }
  });

export const provenanceRecordSchema = z.object({
  id: idSchema,
  generatorId: idSchema,
  generatorVersion: z.string().min(1),
  recipeSchemaVersion: z.number().int().positive(),
  recipeSha256: hashSchema,
  assetSha256: hashSchema,
  inputAssetSha256s: z.array(hashSchema),
  aiGenerated: z.boolean(),
  creator: z.string().min(1).optional(),
  sourceUrl: httpsUrlSchema.optional(),
  modelId: z.string().min(1).optional(),
  modelRevision: z.string().min(1).optional(),
  safetyPolicyRevision: z.string().min(1).optional(),
  c2paCredentialPath: z.string().startsWith('/avatars/provenance/').optional(),
  c2paCredentialSha256: hashSchema.optional(),
  publicationPolicyId: idSchema,
  publicationPolicyRevision: z.string().min(1),
  approvalRefs: z.array(reviewRefSchema),
});

export const tagDefinitionSchema = z.object({
  key: tagKeySchema,
  label: z.string().min(1),
  aliases: z.array(z.string().min(1)),
});

export const avatarRecordSchema = z.object({
  id: avatarIdSchema,
  generatorId: idSchema,
  preset: idSchema,
  assetPath: z.string().regex(/^\/avatars\/[a-z0-9-]+\.(svg|png|webp|avif)$/),
  assetExtension: z.enum(['svg', 'png', 'webp', 'avif']),
  mediaType: z.enum(['image/svg+xml', 'image/png', 'image/webp', 'image/avif']),
  assetSha256: hashSchema,
  width: z.number().int().positive().max(2048),
  height: z.number().int().positive().max(2048),
  alt: z.string().min(1).max(160),
  tags: z.array(tagKeySchema),
  rightsId: idSchema,
  provenanceId: idSchema,
});

export const avatarManifestSchema = z.object({
  schemaVersion: z.literal(1),
  generators: z.array(generatorDescriptorSchema),
  rights: z.array(rightsRecordSchema),
  provenance: z.array(provenanceRecordSchema),
  tagDefinitions: z.array(tagDefinitionSchema),
  avatars: z.array(avatarRecordSchema),
});

export type ReviewRef = z.infer<typeof reviewRefSchema>;
export type GeneratorDescriptor = z.infer<typeof generatorDescriptorSchema>;
export type RightsRecord = z.infer<typeof rightsRecordSchema>;
export type ProvenanceRecord = z.infer<typeof provenanceRecordSchema>;
export type TagDefinition = z.infer<typeof tagDefinitionSchema>;
export type AvatarRecord = z.infer<typeof avatarRecordSchema>;
export type AvatarManifest = z.infer<typeof avatarManifestSchema>;
export type AvatarId = AvatarRecord['id'];
export type TagKey = AvatarRecord['tags'][number];

export interface GeneratorRecipe {
  schemaVersion: 1;
  generatorId: string;
  preset: string;
  input: Readonly<Record<string, string | number | boolean>>;
}
