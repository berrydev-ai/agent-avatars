import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  AvatarManifest,
  TagDefinition,
} from '../../src/lib/contracts/avatar';
import { generateCatalog } from './catalog';
import {
  buildPremiumFlatCatalog,
  PREMIUM_FLAT_RIGHTS_REVIEW_SOURCE,
} from './premium-flat-catalog';
import { validateManifest } from './validate';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

export async function writeGeneratedCatalog(): Promise<void> {
  const dicebearCatalog = generateCatalog();
  const existingAvatarDirectory = join(repositoryRoot, 'public', 'avatars');
  const premiumFlatCatalog = await buildPremiumFlatCatalog(async (filename) => {
    try {
      return await readFile(join(existingAvatarDirectory, filename));
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return undefined;
      }
      throw error;
    }
  });
  const catalog = mergeGeneratedCatalogs([dicebearCatalog, premiumFlatCatalog]);
  await validateManifest(catalog.manifest, (assetPath) =>
    catalog.assets.get(assetPath),
  );

  const publicRoot = join(repositoryRoot, 'public');
  const outputDirectory = join(publicRoot, 'avatars');
  await mkdir(publicRoot, { recursive: true });
  const buildDirectory = await mkdtemp(join(publicRoot, '.avatars-build-'));

  try {
    for (const [assetPath, bytes] of [...catalog.assets.entries()].sort()) {
      await writeFile(
        join(buildDirectory, assetPath.split('/').at(-1) ?? ''),
        bytes,
      );
    }
    await writeFile(
      join(buildDirectory, 'manifest.json'),
      `${JSON.stringify(catalog.manifest, null, 2)}\n`,
      'utf8',
    );

    const backupDirectory = `${outputDirectory}.previous`;
    await rm(backupDirectory, { recursive: true, force: true });
    if (await pathExists(outputDirectory)) {
      await rename(outputDirectory, backupDirectory);
    }
    await rename(buildDirectory, outputDirectory);
    await rm(backupDirectory, { recursive: true, force: true });
  } catch (error) {
    await rm(buildDirectory, { recursive: true, force: true });
    throw error;
  }

  const generatedRoot = join(repositoryRoot, 'generated');
  await mkdir(join(generatedRoot, 'rights'), { recursive: true });
  await writeFile(
    join(generatedRoot, 'avatar-recipes.json'),
    `${JSON.stringify(dicebearCatalog.recipes, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    join(generatedRoot, 'rights', 'dicebear-cc0-review.txt'),
    `${dicebearCatalog.rightsReviewSource}\n`,
    'utf8',
  );
  await writeFile(
    join(generatedRoot, 'rights', 'premium-flat-owned-review.txt'),
    `${PREMIUM_FLAT_RIGHTS_REVIEW_SOURCE}\n`,
    'utf8',
  );

  const files = await readdir(outputDirectory);
  process.stdout.write(
    `Generated ${catalog.manifest.avatars.length} avatars in ${files.length} files.\n`,
  );
}

interface CatalogFiles {
  manifest: AvatarManifest;
  assets: ReadonlyMap<string, Uint8Array>;
}

export function mergeGeneratedCatalogs(
  catalogs: readonly CatalogFiles[],
): CatalogFiles {
  const assets = new Map<string, Uint8Array>();
  for (const catalog of catalogs) {
    for (const [assetPath, bytes] of catalog.assets) {
      if (assets.has(assetPath)) {
        throw new Error(`Duplicate catalog asset path: ${assetPath}.`);
      }
      assets.set(assetPath, bytes);
    }
  }

  return {
    manifest: {
      schemaVersion: 1,
      generators: catalogs
        .flatMap(({ manifest }) => manifest.generators)
        .sort((left, right) => left.id.localeCompare(right.id)),
      rights: catalogs
        .flatMap(({ manifest }) => manifest.rights)
        .sort((left, right) => left.id.localeCompare(right.id)),
      provenance: catalogs
        .flatMap(({ manifest }) => manifest.provenance)
        .sort((left, right) => left.id.localeCompare(right.id)),
      tagDefinitions: mergeTagDefinitions(catalogs),
      avatars: catalogs
        .flatMap(({ manifest }) => manifest.avatars)
        .sort((left, right) => left.id.localeCompare(right.id)),
    },
    assets,
  };
}

function mergeTagDefinitions(
  catalogs: readonly CatalogFiles[],
): TagDefinition[] {
  const definitions = new Map<string, TagDefinition>();
  for (const definition of catalogs.flatMap(
    ({ manifest }) => manifest.tagDefinitions,
  )) {
    const existing = definitions.get(definition.key);
    if (existing && JSON.stringify(existing) !== JSON.stringify(definition)) {
      throw new Error(`Conflicting tag definition: ${definition.key}.`);
    }
    definitions.set(definition.key, definition);
  }
  return [...definitions.values()].sort((left, right) =>
    left.key.localeCompare(right.key),
  );
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await readdir(path);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await writeGeneratedCatalog();
}
