// Vercel serverless function: minimal CORS-enabled HLS proxy.
// Rewrites every URI inside playlists so that sub-playlists and
// segments are also fetched through this proxy (with CORS headers).
module.exports = async function handler(req, res) {
  const target = req.query.url;
  if (!target || !/^https?:\/\//.test(target)) {
    res.statusCode = 400;
    return res.end('missing or invalid url');
  }
  try {
    const r = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': target },
      redirect: 'follow'
    });
    const ct = r.headers.get('content-type') || 'application/octet-stream';
    const finalUrl = r.url || target;
    const buf = Buffer.from(await r.arrayBuffer());
    const isPlaylist =
      ct.includes('mpegurl') ||
      ct.includes('x-mpegurl') ||
      buf.slice(0, 20).toString('utf8').includes('#EXTM3U');

    res.setHeader('Access-Control-Allow-Origin', '*');

    if (isPlaylist) {
      const text = buf.toString('utf8');
      const base = finalUrl.slice(0, finalUrl.lastIndexOf('/') + 1);
      const out = text.replace(/^([^\r\n#].*)$/gm, function (m, line) {
        const t = line.trim();
        if (!t) return m;
        const abs = /^https?:\/\//.test(t) ? t : new URL(t, base).href;
        return '/api/hls?url=' + encodeURIComponent(abs);
      });
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.end(out);
    }

    res.setHeader('Content-Type', ct);
    return res.end(buf);
  } catch (e) {
    res.statusCode = 502;
    return res.end('proxy error: ' + e.message);
  }
};
