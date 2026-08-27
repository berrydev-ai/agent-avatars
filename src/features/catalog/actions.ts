import type { AvatarRecord } from '../../lib/contracts/avatar';

export type CopyResult =
  { status: 'copied' } | { status: 'fallback'; url: string };
export type OpenResult = { status: 'opened' } | { status: 'blocked' };
export type DownloadResult = { status: 'downloaded' } | { status: 'error' };

interface ClipboardWriter {
  writeText(value: string): Promise<void>;
}

interface DownloadDependencies {
  fetchAsset?: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response>;
  hashBytes?: (bytes: Uint8Array) => Promise<string>;
  clickDownload?: (blob: Blob, filename: string) => void;
}

type OpenWindow = (
  url?: string | URL,
  target?: string,
  features?: string,
) => { opener: unknown } | null;

export function canonicalAssetUrl(
  record: AvatarRecord,
  publicSiteOrigin: string,
): string {
  const origin = new URL(publicSiteOrigin);
  if (
    origin.protocol !== 'https:' &&
    !(
      origin.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(origin.hostname)
    )
  ) {
    throw new Error('The public site origin must use HTTPS.');
  }
  if (origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('The public site URL must be an origin without a path.');
  }
  return new URL(record.assetPath, origin).href;
}

export async function copyAvatarLink(
  record: AvatarRecord,
  publicSiteOrigin: string,
  clipboard: ClipboardWriter,
): Promise<CopyResult> {
  const url = canonicalAssetUrl(record, publicSiteOrigin);
  try {
    await clipboard.writeText(url);
    return { status: 'copied' };
  } catch {
    return { status: 'fallback', url };
  }
}

export function openAvatar(
  record: AvatarRecord,
  publicSiteOrigin: string,
  openWindow: OpenWindow,
): OpenResult {
  const opened = openWindow(
    canonicalAssetUrl(record, publicSiteOrigin),
    '_blank',
    'noopener,noreferrer',
  );
  if (!opened) return { status: 'blocked' };
  opened.opener = null;
  return { status: 'opened' };
}

export async function downloadAvatar(
  record: AvatarRecord,
  dependencies: DownloadDependencies = {},
): Promise<DownloadResult> {
  const fetchAsset = dependencies.fetchAsset ?? fetch;
  const hashBytes = dependencies.hashBytes ?? browserSha256;
  const clickDownload = dependencies.clickDownload ?? clickBlobDownload;

  try {
    const response = await fetchAsset(record.assetPath, {
      credentials: 'same-origin',
      headers: { Accept: record.mediaType },
    });
    const contentType = response.headers.get('content-type')?.split(';')[0];
    if (!response.ok || contentType !== record.mediaType) {
      return { status: 'error' };
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (record.mediaType === 'image/svg+xml') {
      const prefix = new TextDecoder().decode(bytes.slice(0, 256)).trimStart();
      if (!prefix.startsWith('<svg')) return { status: 'error' };
    }
    if ((await hashBytes(bytes)) !== record.assetSha256) {
      return { status: 'error' };
    }

    clickDownload(
      new Blob([bytes], { type: record.mediaType }),
      `${record.id}.${record.assetExtension}`,
    );
    return { status: 'downloaded' };
  } catch {
    return { status: 'error' };
  }
}

async function browserSha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(bytes).buffer,
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function clickBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
