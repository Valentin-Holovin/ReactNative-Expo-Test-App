/** Scope local attempts to the exact token without putting credentials in storage keys. */
export async function claimStorageKey(token: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Secure browser storage is unavailable. Open the app over HTTPS.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(token.trim()));
  return 'cashmine.claim.v1.' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function withClaimLock<T>(key: string, signal: AbortSignal, work: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    throw new Error('This browser cannot safely lock claim submissions. Use a current browser over HTTPS.');
  }
  return navigator.locks.request(key, { signal }, work);
}
