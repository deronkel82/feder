import { SCOPE } from './drive.ts';
type Token = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
};
type Google = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (t: Token) => void;
        error_callback: (e: { type: string }) => void;
      }) => { requestAccessToken: (options: { prompt: string }) => void };
      revoke: (token: string, callback: () => void) => void;
    };
  };
};
function google() {
  return (window as unknown as { google?: Google }).google;
}
let loading: Promise<void> | undefined;
export function loadGoogle() {
  if (google()) return Promise.resolve();
  return (loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    const timer = setTimeout(() => {
      loading = undefined;
      script.remove();
      reject(
        Error(
          'Google-Anmeldung konnte nicht geladen werden. Verbindung prüfen.',
        ),
      );
    }, 15000);
    script.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      loading = undefined;
      script.remove();
      reject(Error('Google-Anmeldung nicht erreichbar.'));
    };
    document.head.appendChild(script);
  }));
}
export function authorize(
  clientId: string,
): Promise<{ token: string; expires: number }> {
  return new Promise((resolve, reject) => {
    const sdk = google();
    if (!sdk) {
      reject(Error('Bitte zuerst Google-Anmeldung laden.'));
      return;
    }
    const client = sdk.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (r) => {
        if (
          r.error ||
          !r.access_token ||
          !r.scope?.split(' ').includes(SCOPE)
        ) {
          reject(Error('Die Drive-Freigabe wurde nicht erteilt.'));
          return;
        }
        resolve({
          token: r.access_token,
          expires: Date.now() + (Number(r.expires_in) || 3600) * 1000,
        });
      },
      error_callback: (e) =>
        reject(
          Error(
            e.type === 'popup_closed'
              ? 'Google-Anmeldung abgebrochen.'
              : 'Anmeldefenster blockiert. Pop-ups erlauben und in Safari/Chrome öffnen.',
          ),
        ),
    });
    client.requestAccessToken({ prompt: 'select_account' });
  });
}
