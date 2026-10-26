import { validateObsAddress } from './audio.ts';

export interface SavedObsConnection {
  address: string;
  password: string;
}

type CredentialStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined;

/** An explicit opt-in stores the password in the browser profile, separately from package files and URLs. */
export function readObsConnection(storage: CredentialStorage, key: string): SavedObsConnection | undefined {
  try {
    const value: unknown = JSON.parse(storage?.getItem(key) ?? 'null');
    if (!value || typeof value !== 'object' || !('address' in value) || !('password' in value) ||
        typeof value.address !== 'string' || typeof value.password !== 'string') return;
    return { address: validateObsAddress(value.address), password: value.password };
  } catch { /* Missing, malformed, or inaccessible storage requires a manual connection. */ }
}

export function saveObsConnection(storage: CredentialStorage, key: string, connection: SavedObsConnection): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify({ address: validateObsAddress(connection.address), password: connection.password }));
    return true;
  } catch { return false; }
}

export function forgetObsConnection(storage: CredentialStorage, key: string): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch { return false; }
}

/** Never reuse the saved credential when the user configures another endpoint. */
export function matchesObsAddress(connection: SavedObsConnection | undefined, address: string): boolean {
  try { return connection?.address === validateObsAddress(address); } catch { return false; }
}
