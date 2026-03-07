export const USER_STORAGE_KEY = 'poker:user';

export interface PersistedUser {
  id: string;
  username: string;
  created_at: string;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function getStorageSafely(getStorage: () => Storage): StorageLike | null {
  try {
    return getStorage();
  } catch {
    return null;
  }
}

function safelyRemoveStoredUser(storage: StorageLike) {
  try {
    storage.removeItem(USER_STORAGE_KEY);
  } catch {
    return;
  }
}

function isPersistedUser(value: unknown): value is PersistedUser {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string'
    && typeof candidate.username === 'string'
    && typeof candidate.created_at === 'string';
}

export function loadStoredUser(storage: StorageLike): PersistedUser | null {
  try {
    const raw = storage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!isPersistedUser(parsed)) {
      safelyRemoveStoredUser(storage);
      return null;
    }
    return parsed;
  } catch {
    safelyRemoveStoredUser(storage);
    return null;
  }
}

export function saveStoredUser(storage: StorageLike, user: PersistedUser) {
  try {
    storage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    return;
  }
}

export function clearStoredUser(storage: StorageLike) {
  safelyRemoveStoredUser(storage);
}
