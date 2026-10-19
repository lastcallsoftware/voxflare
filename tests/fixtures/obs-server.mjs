import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { once } from 'node:events';

// Exercise the installed OBS client's own WebSocket transport without adding a dependency.
const { WebSocketServer } = createRequire(import.meta.resolve('obs-websocket-js'))('ws');
const hash = (value) => createHash('sha256').update(value).digest('base64');

/** A test fixture only; VoxFlare itself has no backend. */
export async function createObsServer({ password, refuseRequests = false } = {}) {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  const identifications = [];
  const requests = [];
  const inputs = [{ inputName: 'AI Voice' }, { inputName: '<b>Other source</b>' }];
  const send = (socket, op, d) => socket.send(JSON.stringify({ op, d }));
  server.on('connection', (socket) => {
    send(socket, 0, {
      obsWebSocketVersion: '5.0.0', rpcVersion: 1,
      ...(password ? { authentication: { salt: 'test-salt', challenge: 'test-challenge' } } : {}),
    });
    socket.on('message', (data) => {
      const { op, d } = JSON.parse(String(data));
      if (op === 1) {
        identifications.push(d);
        if (password && d.authentication !== hash(hash(password + 'test-salt') + 'test-challenge')) {
          socket.close(4009, 'Authentication failed');
          return;
        }
        send(socket, 2, { negotiatedRpcVersion: 1 });
      } else if (op === 6) {
        requests.push(d.requestType);
        if (refuseRequests) return;
        send(socket, 7, {
          requestType: d.requestType, requestId: d.requestId,
          requestStatus: { result: true, code: 100 }, responseData: { inputs },
        });
      }
    });
  });
  return {
    url: `ws://127.0.0.1:${server.address().port}`,
    identifications, requests, inputs,
    meters(data) {
      for (const socket of server.clients) {
        send(socket, 5, { eventType: 'InputVolumeMeters', eventIntent: 65536, eventData: { inputs: data } });
      }
    },
    drop() {
      for (const socket of server.clients) socket.close(1001, 'Test disconnect');
    },
    async close() {
      for (const socket of server.clients) socket.terminate();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
