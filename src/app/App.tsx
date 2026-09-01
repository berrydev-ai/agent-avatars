import { useEffect, useState } from 'react';
import {
  avatarManifestSchema,
  type AvatarManifest,
} from '../lib/contracts/avatar';
import { CatalogPage } from '../features/catalog/CatalogPage';
import { CollectionsProvider } from '../features/collections/CollectionsProvider';
import { IdentityProvider } from '../features/identity/IdentityProvider';
import { createIdentityClients, type IdentityClients } from '../lib/supabase';

type CatalogState =
  | { status: 'loading' }
  | { status: 'ready'; manifest: AvatarManifest }
  | { status: 'error' };

const configuredIdentityClients = configureIdentityClients();

export function App() {
  const [catalog, setCatalog] = useState<CatalogState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/avatars/manifest.json', {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Catalog request failed.');
        return avatarManifestSchema.parse(await response.json());
      })
      .then((manifest) => setCatalog({ status: 'ready', manifest }))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setCatalog({ status: 'error' });
        }
      });
    return () => controller.abort();
  }, [attempt]);

  if (catalog.status === 'ready') {
    const rawConfiguredOrigin: unknown = import.meta.env.VITE_PUBLIC_SITE_URL;
    const configuredOrigin =
      typeof rawConfiguredOrigin === 'string' ? rawConfiguredOrigin : '';
    return (
      <IdentityProvider clients={configuredIdentityClients}>
        <CollectionsProvider>
          <CatalogPage
            manifest={catalog.manifest}
            publicSiteOrigin={configuredOrigin || window.location.origin}
          />
        </CollectionsProvider>
      </IdentityProvider>
    );
  }

  return (
    <main className="state-page">
      <header className="site-header">
        <a className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            AA
          </span>
          Agent Avatars
        </a>
      </header>
      {catalog.status === 'loading' ? (
        <section
          className="loading-state"
          aria-busy="true"
          aria-label="Loading avatars"
        >
          <p className="eyebrow">Opening the catalog</p>
          <h1>Finding distinctive faces…</h1>
          <div className="loading-grid" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
              <span key={index} />
            ))}
          </div>
        </section>
      ) : (
        <section className="error-state" role="alert">
          <p className="eyebrow">Catalog unavailable</p>
          <h1>We couldn’t open the avatar library.</h1>
          <p>The manifest did not pass validation. Try the request again.</p>
          <button
            className="button button-primary"
            type="button"
            onClick={() => {
              setCatalog({ status: 'loading' });
              setAttempt((value) => value + 1);
            }}
          >
            Retry
          </button>
        </section>
      )}
    </main>
  );
}

function configureIdentityClients(): IdentityClients | null {
  try {
    return createIdentityClients(import.meta.env, window.sessionStorage);
  } catch {
    return null;
  }
}
