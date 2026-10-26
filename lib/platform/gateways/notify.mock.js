// Records notifications instead of sending them. Can be told to fail so retry / dead-letter paths are testable.

export function createMockNotifyGateway() {
  const sent = [];
  const attempts = [];
  let failing = false;
  const failingChannels = new Set();
  const gw = {
    name: "mock",
    sent,
    attempts,
    failAll() { failing = true; return gw; },
    failChannel(ch) { failingChannels.add(ch); return gw; },
    recover() { failing = false; failingChannels.clear(); return gw; },
    send(n) {
      attempts.push({ id: n.id, channel: n.channel, template: n.template });
      if (failing || failingChannels.has(n.channel)) throw new Error(`mock ${n.channel} provider is down`);
      sent.push({ id: n.id, channel: n.channel, template: n.template, user_id: n.user_id, payload: n.payload });
      return { provider_id: `mock_msg_${sent.length}` };
    },
  };
  return gw;
}
