import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readObsConnection, saveObsConnection, forgetObsConnection, matchesObsAddress } from '../src/obs-credentials.ts';

function storageFixture() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

test('a remembered connection is normalized and bound to its exact OBS endpoint', () => {
  const storage = storageFixture();
  assert.equal(saveObsConnection(storage, 'chatgpt', {
    address: 'ws://127.0.0.1:4455', password: 'fixture-password', ignored: 'extra data',
  }), true);
  const connection = readObsConnection(storage, 'chatgpt');
  assert.deepEqual(connection, { address: 'ws://127.0.0.1:4455/', password: 'fixture-password' });
  assert.equal(matchesObsAddress(connection, 'ws://127.0.0.1:4455'), true);
  for (const address of ['ws://localhost:4455', 'ws://127.0.0.1:4456', 'wss://127.0.0.1:4455', 'ws://another-host:4455', 'invalid']) {
    assert.equal(matchesObsAddress(connection, address), false);
  }
  assert.equal(readObsConnection(storage, 'claude'), undefined);
});

test('forgetting a password removes only the intended entry page credential', () => {
  const storage = storageFixture();
  const connection = { address: 'ws://127.0.0.1:4455', password: '' };
  saveObsConnection(storage, 'chatgpt', connection);
  saveObsConnection(storage, 'claude', connection);
  assert.equal(forgetObsConnection(storage, 'chatgpt'), true);
  assert.equal(readObsConnection(storage, 'chatgpt'), undefined);
  assert.ok(readObsConnection(storage, 'claude'));
});

test('invalid saved data and embedded URL credentials cannot become an automatic connection', () => {
  const storage = storageFixture();
  for (const value of ['{broken', 'null', '[]', '{}', '{"address":12,"password":"x"}', '{"address":"ws://localhost","password":12}']) {
    storage.setItem('entry', value);
    assert.equal(readObsConnection(storage, 'entry'), undefined);
  }
  for (const address of ['https://localhost', 'ws://user:secret@localhost', 'ws://localhost/?password=secret', 'ws://localhost/#secret']) {
    assert.equal(saveObsConnection(storage, 'entry', { address, password: 'fixture' }), false);
    storage.setItem('entry', JSON.stringify({ address, password: 'fixture' }));
    assert.equal(readObsConnection(storage, 'entry'), undefined);
  }
});

test('inaccessible browser storage fails without exposing its error or claiming success', () => {
  const blocked = {
    getItem() { throw new Error('fixture storage error'); },
    setItem() { throw new Error('fixture storage error'); },
    removeItem() { throw new Error('fixture storage error'); },
  };
  for (const storage of [undefined, blocked]) {
    assert.equal(readObsConnection(storage, 'entry'), undefined);
    assert.equal(saveObsConnection(storage, 'entry', { address: 'ws://localhost:4455', password: 'fixture' }), false);
    assert.equal(forgetObsConnection(storage, 'entry'), false);
  }
});
