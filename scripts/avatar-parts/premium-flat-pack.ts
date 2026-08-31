import {
  validatePartPack,
  type AvatarPartPack,
  type AvatarPartVariant,
} from './part-pack';

const BACKGROUNDS = [
  '#0f172a',
  '#1d4ed8',
  '#0f766e',
  '#15803d',
  '#a16207',
  '#c2410c',
  '#be123c',
  '#a21caf',
  '#6d28d9',
  '#475569',
  '#e2e8f0',
  '#fef3c7',
] as const;

const ACCENTS: readonly AvatarPartVariant[] = [
  svg(
    'top-dots',
    '<circle cx="24" cy="24" r="8" fill="#ffffff33"/><circle cx="48" cy="24" r="8" fill="#ffffff22"/><circle cx="72" cy="24" r="8" fill="#ffffff11"/>',
  ),
  svg(
    'corner-blocks',
    '<path d="M0 0h72v18H18v54H0ZM256 184v72h-72v-18h54v-54Z" fill="#ffffff22"/>',
  ),
  svg(
    'diagonal',
    '<path d="M-24 72 72-24h32L-24 104ZM152 280l128-128v32L184 280Z" fill="#ffffff18"/>',
  ),
  svg(
    'orbit',
    '<circle cx="128" cy="128" r="108" fill="none" stroke="#ffffff24" stroke-width="8" stroke-dasharray="24 16"/>',
  ),
  svg(
    'grid',
    '<path d="M0 64h256M0 128h256M0 192h256M64 0v256M128 0v256M192 0v256" fill="none" stroke="#ffffff12" stroke-width="2"/>',
  ),
  svg(
    'sunrise',
    '<circle cx="128" cy="256" r="150" fill="#ffffff12"/><circle cx="128" cy="256" r="104" fill="#ffffff12"/>',
  ),
  svg('split', '<path d="M128 0h128v256H128Z" fill="#00000012"/>'),
  svg(
    'sparkles',
    '<path d="m36 24 5 12 12 5-12 5-5 12-5-12-12-5 12-5Zm184 166 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z" fill="#ffffff55"/>',
  ),
];

const FRAMES: readonly AvatarPartVariant[] = [
  svg(
    'circle',
    '<circle cx="128" cy="128" r="118" fill="none" stroke="#ffffffaa" stroke-width="8"/>',
  ),
  svg(
    'double-circle',
    '<circle cx="128" cy="128" r="120" fill="none" stroke="#ffffff99" stroke-width="4"/><circle cx="128" cy="128" r="110" fill="none" stroke="#ffffff55" stroke-width="3"/>',
  ),
  svg(
    'rounded-square',
    '<rect x="8" y="8" width="240" height="240" rx="40" fill="none" stroke="#ffffffaa" stroke-width="8"/>',
  ),
  svg(
    'brackets',
    '<path d="M72 12H12v60M184 12h60v60M12 184v60h60m112 0h60v-60" fill="none" stroke="#ffffffaa" stroke-width="8" stroke-linecap="round"/>',
  ),
  svg(
    'hexagon',
    '<path d="M68 16h120l60 112-60 112H68L8 128Z" fill="none" stroke="#ffffff99" stroke-width="8"/>',
  ),
];

const BADGES: readonly AvatarPartVariant[] = [
  badge(
    'code',
    '<path d="m207 211-10 10 10 10m18-20 10 10-10 10m-4-24-8 28" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  badge('bolt', '<path d="m220 204-14 19h11l-3 16 16-22h-11Z" fill="#fff"/>'),
  badge(
    'spark',
    '<path d="m220 203 4 12 12 4-12 4-4 12-4-12-12-4 12-4Z" fill="#fff"/>',
  ),
  badge(
    'check',
    '<path d="m207 220 8 8 18-18" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  badge(
    'terminal',
    '<path d="m207 212 8 8-8 8m12 0h13" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  badge(
    'agent',
    '<circle cx="220" cy="219" r="8" fill="none" stroke="#fff" stroke-width="4"/><path d="M207 235c2-7 7-10 13-10s11 3 13 10" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>',
  ),
];

export function normalizePremiumFlatAvatar(source: string): string {
  const document = source
    .trim()
    .replace(/^<\?xml[^>]*>\s*/iu, '')
    .replace(/<title\b[\s\S]*?<\/title>/giu, '')
    .replace(/<desc\b[\s\S]*?<\/desc>/giu, '');
  const root = document.match(/^<svg\b([^>]*)>([\s\S]*)<\/svg>$/iu);
  if (!root) throw new Error('Premium Flat source must be a complete SVG.');

  const viewBox = root[1]?.match(
    /\bviewBox=["'](-?[\d.]+)\s+(-?[\d.]+)\s+([\d.]+)\s+([\d.]+)["']/iu,
  );
  if (!viewBox) throw new Error('Premium Flat source SVG needs a viewBox.');
  const [minX, minY, sourceWidth, sourceHeight] = viewBox
    .slice(1)
    .map(Number) as [number, number, number, number];
  if (
    ![minX, minY, sourceWidth, sourceHeight].every(Number.isFinite) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    throw new Error('Premium Flat source SVG has an invalid viewBox.');
  }

  const scale = 220 / Math.max(sourceWidth, sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  const x = (256 - width) / 2;
  const y = 238 - height;
  const content = (root[2] ?? '')
    .replace(/\s+xmlns(?::[\w-]+)?=["'][^"']+["']/giu, '')
    .replace(/\s+inkscape:[\w-]+=["'][^"']*["']/giu, '')
    .replace(/\s+aria-labelledby=["'][^"']*["']/giu, '');

  return `<svg x="${number(x)}" y="${number(y)}" width="${number(width)}" height="${number(height)}" viewBox="${number(minX)} ${number(minY)} ${number(sourceWidth)} ${number(sourceHeight)}" preserveAspectRatio="xMidYMid meet">${content}</svg>`;
}

export function buildPremiumFlatPack(
  baseMarkups: readonly string[],
): AvatarPartPack {
  if (baseMarkups.length !== 20) {
    throw new Error(
      `Premium Flat pack requires exactly 20 base avatars; received ${baseMarkups.length}.`,
    );
  }

  return validatePartPack({
    schemaVersion: 1,
    id: 'premium-flat-local',
    name: 'Premium Flat Design Characters',
    publication: {
      status: 'local-only',
      reason:
        'The supplied artwork archive contains no license evidence for redistribution or modification.',
    },
    canvas: { width: 256, height: 256 },
    slots: [
      {
        id: 'background',
        optional: false,
        variants: BACKGROUNDS.map((value, index) => ({
          id: `color-${String(index + 1).padStart(2, '0')}`,
          kind: 'color' as const,
          value,
        })),
      },
      { id: 'accent', optional: true, variants: ACCENTS },
      {
        id: 'base',
        optional: false,
        variants: baseMarkups.map((markup, index) => ({
          id: `character-${String(index + 1).padStart(2, '0')}`,
          kind: 'svg' as const,
          markup,
        })),
      },
      { id: 'frame', optional: true, variants: FRAMES },
      { id: 'badge', optional: true, variants: BADGES },
    ],
  });
}

function svg(id: string, content: string): AvatarPartVariant {
  return {
    id,
    kind: 'svg',
    markup: `<svg viewBox="0 0 256 256">${content}</svg>`,
  };
}

function badge(id: string, content: string): AvatarPartVariant {
  return svg(
    id,
    `<circle cx="220" cy="220" r="28" fill="#111827dd" stroke="#fff" stroke-width="4"/>${content}`,
  );
}

function number(value: number): string {
  const rounded = Math.abs(value) < 0.000_000_5 ? 0 : value;
  return Number(rounded.toFixed(4)).toString();
}
