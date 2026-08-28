function canonicalizeValue(value: unknown): string {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(
        'Canonical JSON does not support non-finite numbers.',
      );
    }
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeValue).join(',')}]`;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalizeValue(record[key])}`)
      .join(',')}}`;
  }

  throw new TypeError(`Canonical JSON does not support ${typeof value}.`);
}

export function canonicalJson(value: unknown): string {
  return canonicalizeValue(value);
}
