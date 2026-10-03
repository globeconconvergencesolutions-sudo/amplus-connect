// supabase-js looks up a WebSocket constructor inside createClient(), and on
// Node.js < 22 (no global WebSocket) that throws before any query runs. The
// server never subscribes to realtime channels, so when WebSocket is missing we
// hand realtime a stub that only fails if something actually tries to connect.
class MissingWebSocket {
  constructor() {
    throw new Error(
      'Supabase realtime needs a global WebSocket (Node.js 22+). Server code should not open realtime channels.',
    );
  }
}

export const realtimeOptions =
  typeof globalThis.WebSocket === 'undefined'
    ? { transport: MissingWebSocket as unknown as typeof WebSocket }
    : {};
