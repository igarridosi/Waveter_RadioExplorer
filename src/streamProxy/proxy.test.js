import { describe, it, expect, vi } from 'vitest';
import { proxyStation } from './proxy.js';

const ID = '4a3bd909-1245-43bd-b77d-58053ad16f50';

function fakeFetch({ station, upstream } = {}) {
  return vi.fn(async url => {
    if (url.includes('/json/stations/byuuid/')) {
      return { ok: true, json: async () => (station ? [station] : []) };
    }
    if (upstream instanceof Error) throw upstream;
    return upstream ?? { ok: true, status: 200, headers: new Headers({ 'content-type': 'audio/mpeg' }), body: 'STREAM' };
  });
}

describe('proxyStation', () => {
  it('rejects anything that is not a station id, without touching the network', async () => {
    const fetch = fakeFetch();
    for (const bad of ['', 'http://evil', '../etc', '4a3bd909-1245-43bd-b77d']) {
      expect((await proxyStation(bad, { fetch })).status).toBe(400);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('relays a plain http stream with its audio content type', async () => {
    const fetch = fakeFetch({ station: { url_resolved: 'http://radio.example/live' } });
    const res = await proxyStation(ID, { fetch });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/mpeg');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.text()).toBe('STREAM');
    expect(fetch.mock.calls[1][0]).toBe('http://radio.example/live');
    expect(fetch.mock.calls[1][1].headers['User-Agent']).toContain('Waveter');
  });

  it('is not an open relay: https streams and unknown stations are refused', async () => {
    expect((await proxyStation(ID, { fetch: fakeFetch({ station: { url_resolved: 'https://radio.example/live' } }) })).status).toBe(400);
    expect((await proxyStation(ID, { fetch: fakeFetch({ station: null }) })).status).toBe(404);
  });

  it('refuses private and loopback hosts', async () => {
    for (const host of ['127.0.0.1', 'localhost', '10.0.0.5', '192.168.1.1', '172.20.0.1', '169.254.169.254', 'db.internal', '[::1]']) {
      const fetch = fakeFetch({ station: { url_resolved: `http://${host}/live` } });
      expect((await proxyStation(ID, { fetch })).status).toBe(400);
      expect(fetch).toHaveBeenCalledTimes(1); // lookup only
    }
  });

  it('reports an upstream that fails or does not send audio', async () => {
    const down = fakeFetch({ station: { url_resolved: 'http://radio.example/live' }, upstream: new TypeError('connect ECONNREFUSED') });
    expect((await proxyStation(ID, { fetch: down })).status).toBe(502);

    const notFound = fakeFetch({ station: { url_resolved: 'http://radio.example/live' }, upstream: { ok: false, status: 404, headers: new Headers() } });
    expect((await proxyStation(ID, { fetch: notFound })).status).toBe(502);

    const html = fakeFetch({ station: { url_resolved: 'http://radio.example/live' }, upstream: { ok: true, status: 200, headers: new Headers({ 'content-type': 'text/html' }), body: '<html>' } });
    expect((await proxyStation(ID, { fetch: html })).status).toBe(502);
  });

  it('falls back to the next lookup host', async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new TypeError('down'))
      .mockResolvedValueOnce({ ok: true, json: async () => [{ url_resolved: 'http://radio.example/live' }] })
      .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers({ 'content-type': 'audio/aac' }), body: 'x' });
    const res = await proxyStation(ID, { fetch, hosts: ['a.example', 'b.example'] });
    expect(res.status).toBe(200);
    expect(fetch.mock.calls[1][0]).toContain('https://b.example/json/stations/byuuid/');
  });
});
