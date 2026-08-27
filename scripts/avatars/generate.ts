import {
  mkdir,
  mkdtemp,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateCatalog } from './catalog';
import { validateManifest } from './validate';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

export async function writeGeneratedCatalog(): Promise<void> {
  const catalog = generateCatalog();
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
    `${JSON.stringify(catalog.recipes, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    join(generatedRoot, 'rights', 'dicebear-cc0-review.txt'),
    `${catalog.rightsReviewSource}\n`,
    'utf8',
  );

  const files = await readdir(outputDirectory);
  process.stdout.write(
    `Generated ${catalog.manifest.avatars.length} avatars in ${files.length} files.\n`,
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
