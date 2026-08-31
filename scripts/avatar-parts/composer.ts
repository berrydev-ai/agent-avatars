import { normalizeSvg, validatePublishedSvg } from '../avatars/svg-validator';
import type {
  AvatarPartPack,
  AvatarPartRecipe,
  AvatarPartVariant,
} from './part-pack';

export interface ComposedAvatar {
  bytes: Uint8Array;
  width: number;
  height: number;
}

export function composeAvatar(
  pack: AvatarPartPack,
  recipe: AvatarPartRecipe,
): ComposedAvatar {
  assertRecipeMatchesPack(pack, recipe);

  const layers = pack.slots.flatMap((slot) => {
    const selectedId = recipe.selections[slot.id];
    if (selectedId === null) return [];
    const variant = slot.variants.find(({ id }) => id === selectedId);
    if (!variant) {
      throw new Error(`Unknown ${slot.id} part variant: ${selectedId}.`);
    }
    return [
      renderVariant(slot.id, variant, pack.canvas.width, pack.canvas.height),
    ];
  });

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pack.canvas.width}" height="${pack.canvas.height}" viewBox="0 0 ${pack.canvas.width} ${pack.canvas.height}">`,
    ...layers,
    '</svg>',
  ].join('');
  return validatePublishedSvg(normalizeSvg(svg));
}

function assertRecipeMatchesPack(
  pack: AvatarPartPack,
  recipe: AvatarPartRecipe,
): void {
  if (recipe.schemaVersion !== 1 || recipe.packId !== pack.id) {
    throw new Error('Part recipe does not match the selected part pack.');
  }

  const expectedSlots = [...pack.slots.map(({ id }) => id)].sort();
  const selectedSlots = Object.keys(recipe.selections).sort();
  if (JSON.stringify(expectedSlots) !== JSON.stringify(selectedSlots)) {
    throw new Error('Part recipe selections do not match the pack slots.');
  }

  for (const slot of pack.slots) {
    const selectedId = recipe.selections[slot.id];
    if (selectedId === null && !slot.optional) {
      throw new Error(`Required part slot ${slot.id} cannot be empty.`);
    }
    if (
      selectedId !== null &&
      !slot.variants.some(({ id }) => id === selectedId)
    ) {
      throw new Error(`Unknown ${slot.id} part variant: ${selectedId}.`);
    }
  }
}

function renderVariant(
  slotId: string,
  variant: AvatarPartVariant,
  width: number,
  height: number,
): string {
  if (variant.kind === 'color') {
    return `<rect data-part-slot="${slotId}" data-part-variant="${variant.id}" width="${width}" height="${height}" fill="${variant.value}"/>`;
  }

  const prefix = `${slotId}-${variant.id}-`;
  const markup = namespaceFragmentIds(variant.markup, prefix);
  return `<g data-part-slot="${slotId}" data-part-variant="${variant.id}">${markup}</g>`;
}

function namespaceFragmentIds(markup: string, prefix: string): string {
  const ids = [...markup.matchAll(/\bid=["']([^"']+)["']/giu)].map(
    (match) => match[1],
  );
  let namespaced = markup;
  for (const id of ids) {
    if (!id) continue;
    const escaped = escapeRegExp(id);
    namespaced = namespaced
      .replace(
        new RegExp(`\\bid=(["'])${escaped}\\1`, 'gu'),
        `id="${prefix}${id}"`,
      )
      .replace(
        new RegExp(`url\\((["']?)#${escaped}\\1\\)`, 'gu'),
        `url(#${prefix}${id})`,
      )
      .replace(
        new RegExp(`(href|xlink:href)=(["'])#${escaped}\\2`, 'gu'),
        `$1="#${prefix}${id}"`,
      );
  }
  return namespaced;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
