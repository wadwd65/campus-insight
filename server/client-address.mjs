import { BlockList, isIP } from 'node:net';

function addressOf(value) {
  if (typeof value !== 'string') return null;
  const address = value.trim().replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i, '$1');
  return isIP(address) ? address : null;
}

/** Only explicitly trusted proxy peers may supply client addresses. */
export function createClientAddressResolver(trustedProxies = '') {
  const trusted = new BlockList();
  for (const rule of String(trustedProxies).split(',').map(s => s.trim()).filter(Boolean)) {
    const [raw, prefix, ...extra] = rule.split('/');
    const address = addressOf(raw), family = isIP(address || '');
    if (!address || extra.length || (prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) === 0 || Number(prefix) > (family === 4 ? 32 : 128)))) {
      throw new Error('CAMPUS_TRUSTED_PROXIES must contain comma-separated IP addresses or CIDR networks.');
    }
    if (prefix === undefined) trusted.addAddress(address, family === 4 ? 'ipv4' : 'ipv6');
    else trusted.addSubnet(address, Number(prefix), family === 4 ? 'ipv4' : 'ipv6');
  }
  const isTrusted = address => trusted.check(address, isIP(address) === 4 ? 'ipv4' : 'ipv6');
  return req => {
    const peer = addressOf(req.socket?.remoteAddress);
    if (!peer) return 'unknown-peer';
    if (!isTrusted(peer)) return peer;
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded !== 'string' || forwarded.length > 2048) return peer;
    const chain = forwarded.split(',').map(addressOf);
    if (!chain.length || chain.length > 32 || chain.some(address => !address)) return peer;
    let current = peer;
    for (let i = chain.length - 1; i >= 0 && isTrusted(current); i--) current = chain[i];
    return current;
  };
}
