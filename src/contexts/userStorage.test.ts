import test from 'node:test';
import assert from 'node:assert/strict';

import { clearStoredUser, getStorageSafely, loadStoredUser, saveStoredUser, USER_STORAGE_KEY } from './userStorage';

type StoredUser = {
  id: string;
  username: string;
  created_at: string;
};

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

class ThrowingStorage extends MemoryStorage {
  override getItem(_key: string): string | null {
    throw new Error('storage blocked');
  }

  override setItem(_key: string, _value: string) {
    throw new Error('storage blocked');
  }

  override removeItem(_key: string) {
    throw new Error('storage blocked');
  }
}

const sampleUser: StoredUser = {
  id: 'u1',
  username: 'terry',
  created_at: '2026-03-07T00:00:00.000Z',
};

test('saveStoredUser stores serialized user and loadStoredUser returns it', () => {
  const storage = new MemoryStorage();

  saveStoredUser(storage, sampleUser);

  assert.equal(storage.getItem(USER_STORAGE_KEY), JSON.stringify(sampleUser));
  assert.deepEqual(loadStoredUser(storage), sampleUser);
});

test('loadStoredUser returns null and clears invalid json', () => {
  const storage = new MemoryStorage();
  storage.setItem(USER_STORAGE_KEY, '{bad json');

  assert.equal(loadStoredUser(storage), null);
  assert.equal(storage.getItem(USER_STORAGE_KEY), null);
});

test('loadStoredUser returns null and clears invalid user shape', () => {
  const storage = new MemoryStorage();
  storage.setItem(USER_STORAGE_KEY, JSON.stringify({ id: 'u1' }));

  assert.equal(loadStoredUser(storage), null);
  assert.equal(storage.getItem(USER_STORAGE_KEY), null);
});

test('clearStoredUser removes persisted user', () => {
  const storage = new MemoryStorage();
  saveStoredUser(storage, sampleUser);

  clearStoredUser(storage);

  assert.equal(storage.getItem(USER_STORAGE_KEY), null);
});

test('storage helpers tolerate storage access errors', () => {
  const storage = new ThrowingStorage();

  assert.equal(loadStoredUser(storage), null);
  assert.doesNotThrow(() => saveStoredUser(storage, sampleUser));
  assert.doesNotThrow(() => clearStoredUser(storage));
});

test('getStorageSafely returns null when storage getter throws', () => {
  const storage = getStorageSafely(() => {
    throw new Error('blocked');
  });

  assert.equal(storage, null);
});
