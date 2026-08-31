import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from '../avatars/hash';
import { composeAvatar } from './composer';
import { combinationCount, recipeAt, validatePartPack } from './part-pack';

const MAX_SAMPLE_COUNT = 10_000;

export function sampleRecipeIndexes(
  total: bigint,
  requestedCount: number,
): readonly bigint[] {
  if (total <= 0n) throw new RangeError('Combination total must be positive.');
  if (
    !Number.isInteger(requestedCount) ||
    requestedCount <= 0 ||
    requestedCount > MAX_SAMPLE_COUNT
  ) {
    throw new RangeError(
      `Sample count must be an integer between 1 and ${MAX_SAMPLE_COUNT}.`,
    );
  }

  const count = total < BigInt(requestedCount) ? Number(total) : requestedCount;
  if (count === 1) return [0n];
  return Array.from(
    { length: count },
    (_, index) => (BigInt(index) * (total - 1n)) / BigInt(count - 1),
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const pack = validatePartPack(
    JSON.parse(await readFile(args.packPath, 'utf8')) as unknown,
  );
  const total = combinationCount(pack);
  const indexes = sampleRecipeIndexes(total, args.count);
  const assetDirectory = join(args.outputDirectory, 'assets');
  await mkdir(dirname(args.outputDirectory), { recursive: true });
  await mkdir(args.outputDirectory, { recursive: false });
  await mkdir(assetDirectory, { recursive: false });

  const records = [];
  for (const index of indexes) {
    const recipe = recipeAt(pack, index);
    const asset = composeAvatar(pack, recipe);
    const assetSha256 = sha256(asset.bytes);
    const filename = `part-avatar-${assetSha256.slice(0, 20)}.svg`;
    await writeFile(join(assetDirectory, filename), asset.bytes, {
      flag: 'wx',
    });
    records.push({
      index: index.toString(),
      filename,
      assetSha256,
      recipe,
    });
  }

  const manifest = {
    schemaVersion: 1,
    packId: pack.id,
    packName: pack.name,
    publication: pack.publication,
    totalCombinations: total.toString(),
    generatedCount: records.length,
    assets: records,
  };
  await writeFile(
    join(args.outputDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: 'wx' },
  );
  await writeFile(
    join(args.outputDirectory, 'index.html'),
    contactSheetHtml(pack.name, records),
    { flag: 'wx' },
  );
  process.stdout.write(
    `Generated ${records.length} of ${total.toString()} combinations in ${args.outputDirectory}.\n`,
  );
}

function parseArgs(argv: readonly string[]): {
  packPath: string;
  outputDirectory: string;
  count: number;
} {
  const valueAfter = (name: string): string | undefined => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const packPath = valueAfter('--pack');
  const outputDirectory = valueAfter('--output');
  const rawCount = valueAfter('--count') ?? '256';
  const count = Number(rawCount);
  if (!packPath || !outputDirectory) {
    throw new Error(
      'Usage: npm run parts:generate -- --pack PACK.json --output DIRECTORY [--count 256]',
    );
  }
  if (!Number.isInteger(count) || count <= 0 || count > MAX_SAMPLE_COUNT) {
    throw new Error(
      `--count must be an integer between 1 and ${MAX_SAMPLE_COUNT}.`,
    );
  }
  return { packPath, outputDirectory, count };
}

function contactSheetHtml(
  packName: string,
  records: readonly { filename: string; index: string }[],
): string {
  const cards = records
    .map(
      ({ filename, index }) =>
        `<figure><img src="assets/${filename}" alt="Combination ${index}"><figcaption>#${index}</figcaption></figure>`,
    )
    .join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(packName)} preview</title><style>body{font-family:system-ui;margin:24px;background:#0f172a;color:#f8fafc}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(144px,1fr));gap:16px}figure{margin:0;padding:8px;background:#1e293b;border-radius:12px}img{display:block;width:100%;border-radius:8px}figcaption{padding-top:6px;font-size:12px;color:#cbd5e1}</style><h1>${escapeHtml(packName)}</h1><main>${cards}</main></html>\n`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/gu,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] ?? character,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
