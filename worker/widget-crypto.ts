function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
export const widgetSecret = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
export async function widgetDigest(value: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}
export const widgetAccessToken = (code: string, verifier: string) =>
  widgetDigest(`worth-widget-access-v1\0${code}\0${verifier}`);
