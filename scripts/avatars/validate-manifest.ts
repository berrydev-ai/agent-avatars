import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateManifest } from './validate';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const avatarRoot = join(repositoryRoot, 'public', 'avatars');

export async function validateGeneratedCatalog(): Promise<void> {
  const manifest = JSON.parse(
    await readFile(join(avatarRoot, 'manifest.json'), 'utf8'),
  ) as unknown;
  const validated = await validateManifest(manifest, async (assetPath) => {
    const filename = assetPath.split('/').at(-1);
    if (!filename || filename.includes('..')) return undefined;
    try {
      return await readFile(join(avatarRoot, filename));
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
  process.stdout.write(
    `Validated ${validated.avatars.length} avatar records.\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await validateGeneratedCatalog();
}
