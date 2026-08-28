const MAX_SVG_BYTES = 5 * 1024 * 1024;
const MAX_NODES = 10_000;
const MAX_DEPTH = 64;
const ALLOWED_ELEMENTS = new Set([
  'svg',
  'defs',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'clipPath',
  'mask',
  'linearGradient',
  'radialGradient',
  'stop',
  'use',
]);

export interface ValidatedSvg {
  bytes: Uint8Array;
  width: number;
  height: number;
}

export function normalizeSvg(svg: string): Uint8Array {
  const normalized = svg
    .replace(/<metadata\b[\s\S]*?<\/metadata>/giu, '')
    .replace(/<!--[\s\S]*?-->/gu, '')
    .replace(/\sstyle=["']mix-blend-mode:difference["']/giu, '')
    .replace(
      /\sstyle=["']mask-type:(alpha|luminance)["']/giu,
      ' mask-type="$1"',
    )
    .trim();
  return Buffer.from(normalized, 'utf8');
}

export function validatePublishedSvg(bytes: Uint8Array): ValidatedSvg {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_SVG_BYTES) {
    throw new Error('SVG exceeds the publication size limit.');
  }

  const svg = Buffer.from(bytes).toString('utf8');
  const forbiddenPatterns: readonly [RegExp, string][] = [
    [/<\s*script\b/iu, 'SVG script elements are forbidden.'],
    [/<!\s*(doctype|entity)\b/iu, 'SVG document declarations are forbidden.'],
    [/<\s*foreignObject\b/iu, 'SVG foreignObject is forbidden.'],
    [/<\s*style\b|\sstyle\s*=/iu, 'SVG CSS is forbidden.'],
    [
      /<\s*(animate|set|filter)\b/iu,
      'SVG animation and filters are forbidden.',
    ],
    [/\son[a-z]+\s*=/iu, 'SVG event attributes are forbidden.'],
    [
      /\b(?:javascript|data):/iu,
      'SVG executable or embedded data is forbidden.',
    ],
  ];

  for (const [pattern, message] of forbiddenPatterns) {
    if (pattern.test(svg)) throw new Error(message);
  }

  for (const match of svg.matchAll(
    /(?:href|xlink:href)\s*=\s*["']([^"']+)["']/giu,
  )) {
    if (!match[1]?.startsWith('#')) {
      throw new Error('SVG references must use a same-document fragment.');
    }
  }

  for (const match of svg.matchAll(/url\(([^)]+)\)/giu)) {
    const value = match[1]?.trim().replace(/^['"]|['"]$/gu, '');
    if (!value?.startsWith('#')) {
      throw new Error('SVG URL references must use a same-document fragment.');
    }
  }

  let nodes = 0;
  let depth = 0;
  for (const match of svg.matchAll(/<\/?([A-Za-z][\w:-]*)\b[^>]*>/gu)) {
    const token = match[0];
    const rawName = match[1];
    if (!rawName) continue;
    const name = rawName.includes(':') ? rawName.split(':').at(-1) : rawName;
    if (!name || !ALLOWED_ELEMENTS.has(name)) {
      throw new Error(`SVG element ${rawName} is not allowlisted.`);
    }
    if (!token.startsWith('</')) {
      nodes += 1;
      if (!token.endsWith('/>')) depth += 1;
      if (nodes > MAX_NODES || depth > MAX_DEPTH) {
        throw new Error('SVG structure exceeds publication limits.');
      }
    } else {
      depth -= 1;
      if (depth < 0) throw new Error('SVG element nesting is invalid.');
    }
  }

  if (depth !== 0 || nodes === 0 || !/^<svg\b/iu.test(svg)) {
    throw new Error('SVG document structure is invalid.');
  }

  const root = svg.match(/^<svg\b([^>]*)>/iu)?.[1] ?? '';
  const width = Number(root.match(/\bwidth=["'](\d+)["']/iu)?.[1]);
  const height = Number(root.match(/\bheight=["'](\d+)["']/iu)?.[1]);
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width !== height
  ) {
    throw new Error('SVG must declare equal positive integer dimensions.');
  }
  if (width <= 0 || width > 2048) {
    throw new Error('SVG dimensions exceed publication limits.');
  }

  return { bytes, width, height };
}
