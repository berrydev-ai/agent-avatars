import { z } from 'zod';
import premiumFlatSampleInput from '../../generated/premium-flat-sample.json' with { type: 'json' };
import type {
  AvatarManifest,
  AvatarRecord,
  ProvenanceRecord,
  RightsRecord,
  TagDefinition,
  TagKey,
} from '../../src/lib/contracts/avatar';
import { canonicalJson } from './canonical-json';
import { TAG_DEFINITIONS } from './config';
import { sha256 } from './hash';
import { validatePublishedSvg } from './svg-validator';

const PR_URL = 'https://github.com/berrydev-ai/agent-avatars/pull/14';
const RIGHTS_ID = 'premium-flat-owned-v1';
const HASH_PATTERN = /^[0-9a-f]{64}$/u;

export const PREMIUM_FLAT_RIGHTS_REVIEW_SOURCE = [
  `Owner confirmation recorded 2026-09-01 for ${PR_URL}.`,
  'Berry Development, LLC owns the Premium Flat Design Characters artwork and approves download, redistribution, commercial use, and modification of the published avatar samples.',
].join('\n');

const sampleSchema = z
  .object({
    schemaVersion: z.literal(1),
    packId: z.literal('premium-flat'),
    packName: z.string().min(1),
    publication: z.object({
      status: z.literal('approved'),
      rightsId: z.literal(RIGHTS_ID),
      reviewRef: z.literal(PR_URL),
    }),
    sourcePackSha256: z.string().regex(HASH_PATTERN),
    totalCombinations: z.string().regex(/^\d+$/u),
    generatedCount: z.literal(256),
    assets: z.array(
      z.object({
        index: z.string().regex(/^\d+$/u),
        filename: z.string().regex(/^part-avatar-[0-9a-f]{20}\.svg$/u),
        assetSha256: z.string().regex(HASH_PATTERN),
        recipe: z.object({
          schemaVersion: z.literal(1),
          packId: z.literal('premium-flat-local'),
          selections: z.object({
            accent: z.string().nullable(),
            background: z.string(),
            badge: z.string().nullable(),
            base: z.string(),
            frame: z.string().nullable(),
          }),
        }),
      }),
    ),
  })
  .superRefine((sample, context) => {
    if (sample.assets.length !== sample.generatedCount) {
      context.addIssue({
        code: 'custom',
        message: 'Premium Flat generated count does not match its assets.',
        path: ['assets'],
      });
    }
    addDuplicateIssue(
      sample.assets.map(({ assetSha256 }) => assetSha256),
      'asset hash',
      context,
    );
    addDuplicateIssue(
      sample.assets.map(({ index }) => index),
      'recipe index',
      context,
    );
    for (const [index, asset] of sample.assets.entries()) {
      if (
        asset.filename !== `part-avatar-${asset.assetSha256.slice(0, 20)}.svg`
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Premium Flat filename does not match its asset hash.',
          path: ['assets', index, 'filename'],
        });
      }
    }
  });

const backgroundTags: Readonly<Record<string, readonly [TagKey, string]>> = {
  'color-01': ['color:navy', 'navy'],
  'color-02': ['color:blue', 'blue'],
  'color-03': ['color:teal', 'teal'],
  'color-04': ['color:green', 'green'],
  'color-05': ['color:yellow', 'gold'],
  'color-06': ['color:orange', 'orange'],
  'color-07': ['color:pink', 'crimson'],
  'color-08': ['color:purple', 'magenta'],
  'color-09': ['color:purple', 'purple'],
  'color-10': ['color:slate', 'slate'],
  'color-11': ['color:gray', 'light gray'],
  'color-12': ['color:yellow', 'cream'],
};

const extraTagDefinitions: readonly TagDefinition[] = [
  {
    key: 'accessory:badge',
    label: 'Badge',
    aliases: ['badge', 'icon'],
  },
  {
    key: 'accessory:frame',
    label: 'Frame',
    aliases: ['border', 'frame'],
  },
  { key: 'color:gray', label: 'Gray', aliases: ['gray', 'grey'] },
  { key: 'color:navy', label: 'Navy', aliases: ['dark blue', 'navy'] },
  { key: 'color:slate', label: 'Slate', aliases: ['slate'] },
  { key: 'color:teal', label: 'Teal', aliases: ['teal'] },
  {
    key: 'theme:flat',
    label: 'Flat design',
    aliases: ['flat', 'flat design', 'vector'],
  },
];

const inheritedTagKeys = new Set<TagKey>([
  'color:blue',
  'color:green',
  'color:orange',
  'color:pink',
  'color:purple',
  'color:yellow',
]);

export interface PremiumFlatCatalog {
  manifest: AvatarManifest;
  assets: ReadonlyMap<string, Uint8Array>;
  rightsReviewSource: string;
}

export async function buildPremiumFlatCatalog(
  readAsset: (
    filename: string,
  ) => Promise<Uint8Array | undefined> | Uint8Array | undefined,
): Promise<PremiumFlatCatalog> {
  const sample = sampleSchema.parse(premiumFlatSampleInput);
  const rights: RightsRecord = {
    id: RIGHTS_ID,
    basis: 'owned',
    name: 'Berry Development owned Premium Flat artwork',
    url: PR_URL,
    policyRevision: '2026-09-01',
    reviewedSourceSha256: sha256(`${PREMIUM_FLAT_RIGHTS_REVIEW_SOURCE}\n`),
    attributionRequired: false,
    downloadAllowed: true,
    redistributionAllowed: true,
    commercialUseAllowed: true,
    modificationsAllowed: true,
    reviewedAt: '2026-09-01',
  };
  const assets = new Map<string, Uint8Array>();
  const avatars: AvatarRecord[] = [];
  const provenance: ProvenanceRecord[] = [];

  for (const record of sample.assets) {
    const id = `premium-flat-${record.assetSha256.slice(0, 20)}`;
    const filename = `${id}.svg`;
    const assetPath = `/avatars/${filename}`;
    const bytes = await readAsset(filename);
    if (!bytes) throw new Error(`Premium Flat asset is missing: ${filename}.`);
    if (sha256(bytes) !== record.assetSha256) {
      throw new Error(`Premium Flat asset hash mismatch: ${filename}.`);
    }
    const validated = validatePublishedSvg(bytes);
    const background = backgroundTags[record.recipe.selections.background];
    if (!background) {
      throw new Error(
        `Unknown Premium Flat background: ${record.recipe.selections.background}.`,
      );
    }
    const tags: TagKey[] = [background[0], 'theme:flat'];
    if (record.recipe.selections.badge) tags.push('accessory:badge');
    if (record.recipe.selections.frame) tags.push('accessory:frame');
    const provenanceId = `premium-flat-provenance-${record.assetSha256.slice(0, 20)}`;

    assets.set(assetPath, bytes);
    avatars.push({
      id,
      generatorId: 'premium-flat',
      preset: 'premium-flat',
      assetPath,
      assetExtension: 'svg',
      mediaType: 'image/svg+xml',
      assetSha256: record.assetSha256,
      width: validated.width,
      height: validated.height,
      alt: describePremiumFlatAvatar(record.recipe.selections, background[1]),
      tags: [...new Set(tags)].sort(),
      rightsId: rights.id,
      provenanceId,
    });
    provenance.push({
      id: provenanceId,
      generatorId: 'premium-flat',
      generatorVersion: '1',
      recipeSchemaVersion: record.recipe.schemaVersion,
      recipeSha256: sha256(canonicalJson(record.recipe)),
      assetSha256: record.assetSha256,
      inputAssetSha256s: [sample.sourcePackSha256],
      aiGenerated: false,
      creator: 'Berry Development, LLC',
      sourceUrl: PR_URL,
      publicationPolicyId: RIGHTS_ID,
      publicationPolicyRevision: rights.policyRevision,
      approvalRefs: [{ system: 'github', id: '14', url: PR_URL }],
    });
  }

  const tagDefinitions = [
    ...TAG_DEFINITIONS.filter(({ key }) => inheritedTagKeys.has(key)),
    ...extraTagDefinitions,
  ].sort((left, right) => left.key.localeCompare(right.key));
  avatars.sort((left, right) => left.id.localeCompare(right.id));
  provenance.sort((left, right) => left.id.localeCompare(right.id));

  return {
    manifest: {
      schemaVersion: 1,
      generators: [
        {
          id: 'premium-flat',
          adapterApiVersion: 1,
          name: 'Premium Flat Composer',
          kind: 'procedural',
          engine: 'agent-avatars/avatar-parts',
          engineVersion: '1',
          components: {
            'premium-flat-base-characters': '20',
            'premium-flat-sample': '256',
          },
          sourceUrl: PR_URL,
          reproducibility: 'best-effort',
          outputMediaTypes: ['image/svg+xml'],
        },
      ],
      rights: [rights],
      provenance,
      tagDefinitions,
      avatars,
    },
    assets,
    rightsReviewSource: PREMIUM_FLAT_RIGHTS_REVIEW_SOURCE,
  };
}

function describePremiumFlatAvatar(
  selections: {
    accent: string | null;
    badge: string | null;
    base: string;
    frame: string | null;
  },
  background: string,
): string {
  const details = [
    `${humanize(selections.base)} base`,
    `${background} background`,
    selections.accent ? `${humanize(selections.accent)} accent` : undefined,
    selections.frame ? `${humanize(selections.frame)} frame` : undefined,
    selections.badge ? `${humanize(selections.badge)} badge` : undefined,
  ].filter((detail): detail is string => Boolean(detail));
  return `Premium Flat agent avatar with ${details.join(', ')}`;
}

function humanize(value: string): string {
  return value.replaceAll('-', ' ');
}

function addDuplicateIssue(
  values: readonly string[],
  label: string,
  context: z.RefinementCtx,
): void {
  if (new Set(values).size !== values.length) {
    context.addIssue({
      code: 'custom',
      message: `Premium Flat sample has a duplicate ${label}.`,
      path: ['assets'],
    });
  }
}
