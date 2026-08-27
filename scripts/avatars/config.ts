import loreleiDefinition from '@dicebear/styles/lorelei.json' with { type: 'json' };
import loreleiNeutralDefinition from '@dicebear/styles/lorelei-neutral.json' with { type: 'json' };
import notionistsDefinition from '@dicebear/styles/notionists.json' with { type: 'json' };
import notionistsNeutralDefinition from '@dicebear/styles/notionists-neutral.json' with { type: 'json' };
import pixelArtDefinition from '@dicebear/styles/pixel-art.json' with { type: 'json' };
import pixelArtNeutralDefinition from '@dicebear/styles/pixel-art-neutral.json' with { type: 'json' };
import type { TagDefinition } from '../../src/lib/contracts/avatar';

export interface StyleConfig {
  slug: string;
  name: string;
  definition: unknown;
  glassesVariant: string;
  smileVariant: string;
  bigEyesVariant: string;
  bald: boolean;
  theme: 'hand-drawn' | 'professional' | 'retro';
}

export const STYLE_CONFIGS: readonly StyleConfig[] = [
  {
    slug: 'lorelei',
    name: 'Lorelei',
    definition: loreleiDefinition,
    glassesVariant: 'variant01',
    smileVariant: 'happy01',
    bigEyesVariant: 'variant01',
    bald: false,
    theme: 'hand-drawn',
  },
  {
    slug: 'lorelei-neutral',
    name: 'Lorelei Neutral',
    definition: loreleiNeutralDefinition,
    glassesVariant: 'variant02',
    smileVariant: 'happy02',
    bigEyesVariant: 'variant02',
    bald: true,
    theme: 'hand-drawn',
  },
  {
    slug: 'notionists',
    name: 'Notionists',
    definition: notionistsDefinition,
    glassesVariant: 'variant03',
    smileVariant: 'variant01',
    bigEyesVariant: 'variant01',
    bald: false,
    theme: 'professional',
  },
  {
    slug: 'notionists-neutral',
    name: 'Notionists Neutral',
    definition: notionistsNeutralDefinition,
    glassesVariant: 'variant04',
    smileVariant: 'variant02',
    bigEyesVariant: 'variant02',
    bald: true,
    theme: 'professional',
  },
  {
    slug: 'pixel-art',
    name: 'Pixel Art',
    definition: pixelArtDefinition,
    glassesVariant: 'dark01',
    smileVariant: 'happy01',
    bigEyesVariant: 'variant01',
    bald: false,
    theme: 'retro',
  },
  {
    slug: 'pixel-art-neutral',
    name: 'Pixel Art Neutral',
    definition: pixelArtNeutralDefinition,
    glassesVariant: 'light01',
    smileVariant: 'happy02',
    bigEyesVariant: 'variant02',
    bald: true,
    theme: 'retro',
  },
] as const;

export const PALETTE = [
  { key: 'color:yellow', label: 'Yellow', value: '#f4c95d' },
  { key: 'color:blue', label: 'Blue', value: '#a8d8ea' },
  { key: 'color:pink', label: 'Pink', value: '#f5c2c7' },
  { key: 'color:green', label: 'Green', value: '#b9dfc5' },
  { key: 'color:orange', label: 'Orange', value: '#f3b562' },
  { key: 'color:purple', label: 'Purple', value: '#c9b6e4' },
] as const;

export const TAG_DEFINITIONS: readonly TagDefinition[] = [
  {
    key: 'accessory:glasses',
    label: 'Glasses',
    aliases: ['eyeglasses', 'glasses', 'spectacles'],
  },
  { key: 'color:blue', label: 'Blue', aliases: ['blue'] },
  { key: 'color:green', label: 'Green', aliases: ['green'] },
  { key: 'color:orange', label: 'Orange', aliases: ['orange'] },
  { key: 'color:pink', label: 'Pink', aliases: ['pink'] },
  { key: 'color:purple', label: 'Purple', aliases: ['purple', 'violet'] },
  { key: 'color:yellow', label: 'Yellow', aliases: ['gold', 'yellow'] },
  {
    key: 'expression:smile',
    label: 'Smile',
    aliases: ['happy', 'smile', 'smiling'],
  },
  { key: 'eye:big', label: 'Big eyes', aliases: ['big eyes', 'large eyes'] },
  { key: 'hair:bald', label: 'Bald', aliases: ['bald', 'no hair'] },
  {
    key: 'theme:hand-drawn',
    label: 'Hand drawn',
    aliases: ['hand drawn', 'illustrated', 'sketch'],
  },
  { key: 'theme:nerd', label: 'Nerd', aliases: ['geek', 'geeky', 'nerd'] },
  {
    key: 'theme:professional',
    label: 'Professional',
    aliases: ['office', 'professional', 'work'],
  },
  { key: 'theme:retro', label: 'Retro', aliases: ['8 bit', 'pixel', 'retro'] },
] as const;
