import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildPremiumFlatPack,
  normalizePremiumFlatAvatar,
} from './premium-flat-pack';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const entries = await readdir(args.sourceDirectory, { withFileTypes: true });
  const filenames = entries
    .filter(
      (entry) =>
        entry.isFile() && /^avatar-(?:0[1-9]|1\d|20)\.svg$/u.test(entry.name),
    )
    .map(({ name }) => name)
    .sort();
  if (filenames.length !== 20) {
    throw new Error(
      `Expected avatar-01.svg through avatar-20.svg; found ${filenames.length} matching files.`,
    );
  }

  const bases = await Promise.all(
    filenames.map(async (filename) =>
      normalizePremiumFlatAvatar(
        await readFile(join(args.sourceDirectory, filename), 'utf8'),
      ),
    ),
  );
  const pack = buildPremiumFlatPack(bases);
  await mkdir(dirname(args.outputFile), { recursive: true });
  await writeFile(args.outputFile, `${JSON.stringify(pack, null, 2)}\n`, {
    flag: 'wx',
  });
  process.stdout.write(
    `Imported ${bases.length} base avatars into ${args.outputFile}.\n`,
  );
}

function parseArgs(argv: readonly string[]): {
  sourceDirectory: string;
  outputFile: string;
} {
  const valueAfter = (name: string): string | undefined => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const sourceDirectory = valueAfter('--source');
  const outputFile = valueAfter('--output');
  if (!sourceDirectory || !outputFile) {
    throw new Error(
      'Usage: npm run parts:import-premium-flat -- --source EXTRACTED_SVG_DIRECTORY --output PACK.json',
    );
  }
  return { sourceDirectory, outputFile };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
