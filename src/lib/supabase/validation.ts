import { z } from 'zod';

import type { AvatarId, EmailPasswordInput } from '../contracts/identity';
import { validationError } from './errors';

const avatarIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{20}$/)
  .transform((value) => value as AvatarId);

const uuidSchema = z.uuid();
const teamCursorSchema = z.object({
  updatedAt: z.iso.datetime({ offset: true }),
  id: uuidSchema,
});

export interface TeamCursor {
  updatedAt: string;
  id: string;
}

export function parseEmailPassword(
  input: EmailPasswordInput,
): EmailPasswordInput {
  return asValidationError(() => {
    const email = z.email().max(254).parse(input.email.trim());
    const password = z.string().parse(input.password);
    const passwordBytes = new TextEncoder().encode(password).byteLength;
    if (passwordBytes < 12 || passwordBytes > 72)
      throw new Error('password byte length');
    return { email, password };
  });
}

export function parseAvatarId(input: string): AvatarId {
  return asValidationError(() => avatarIdSchema.parse(input));
}

export function parseTeamName(input: string): string {
  return asValidationError(() => {
    const name = z.string().trim().parse(input);
    const length = Array.from(name).length;
    if (length < 1 || length > 80) throw new Error('team name length');
    return name;
  });
}

export function parseUuid(input: string): string {
  return asValidationError(() => uuidSchema.parse(input));
}

export function parseMemberIds(input: readonly string[]): readonly AvatarId[] {
  return asValidationError(() => {
    if (input.length > 100) throw new Error('team member limit');
    const parsed = input.map((value) => avatarIdSchema.parse(value));
    if (new Set(parsed).size !== parsed.length)
      throw new Error('duplicate team member');
    return parsed;
  });
}

export function parsePageLimit(input: number | undefined): number {
  return asValidationError(() =>
    z.number().int().min(1).max(50).default(25).parse(input),
  );
}

export function encodeTeamCursor(cursor: TeamCursor): string {
  const parsed = asValidationError(() => teamCursorSchema.parse(cursor));
  return btoa(JSON.stringify(parsed))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
}

export function decodeTeamCursor(cursor: string): TeamCursor {
  return asValidationError(() => {
    if (cursor.length < 1 || cursor.length > 512)
      throw new Error('cursor length');
    const base64 = cursor.replaceAll('-', '+').replaceAll('_', '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return teamCursorSchema.parse(JSON.parse(atob(padded)) as unknown);
  });
}

export function parseTokenHash(input: string): string {
  return asValidationError(() => z.string().min(1).max(4096).parse(input));
}

function asValidationError<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    throw validationError(error);
  }
}
