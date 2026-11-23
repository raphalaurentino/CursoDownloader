'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { randomBytes } = require('crypto');
const { spawn } = require('child_process');
const readline = require('readline/promises');

function attrs(line) {
  return Object.fromEntries([...line.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g)]
    .map(m => [m[1], m[2].replace(/^"|"$/g, '')]));
}
function variants(text, base) {
  const lines = text.split(/\r?\n/).map(x => x.trim());
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('#EXT-X-STREAM-INF:')) continue;
    const a = attrs(lines[i]);
    const uri = lines.slice(i + 1).find(x => x && !x.startsWith('#'));
    if (uri) result.push({ url: new URL(uri, base).href, line: lines[i],
      height: Number((a.RESOLUTION || '').split('x')[1]) || 0,
      bandwidth: Number(a.BANDWIDTH) || 0 });
  }
  return result.sort((a, b) => b.height - a.height || b.bandwidth - a.bandwidth);
}
function isMedia(url, type = '') {
  const p = new URL(url).pathname;
  return /\.(m3u8|mp4)$/i.test(p) || /mpegurl|video\/mp4/i.test(type);
}
function protectedPlaylist(text) {
  return text.split(/\r?\n/).some(line => {
    if (!/^#EXT-X-(SESSION-)?KEY:/.test(line)) return false;
    const a = attrs(line);
    return a.METHOD !== 'NONE' && (a.METHOD !== 'AES-128' || (a.KEYFORMAT && a.KEYFORMAT !== 'identity'));
  });
}
function rewrite(text, base, local, selected) {
  if (protectedPlaylist(text)) throw new Error('Playlist com proteção DRM não suportada.');
  let skipUri = false;
  return text.split(/\r?\n/).flatMap(raw => {
    const line = raw.trim();
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      skipUri = Boolean(selected && line !== selected.line);
      return skipUri ? [] : [line];
    }
    if (line && !line.startsWith('#')) {
      if (skipUri) { skipUri = false; return []; }
      return [local(new URL(line, base).href)];
    }
    return [line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${local(new URL(uri, base).href)}"`)];
  }).join('\n');
}
function safeName(name) {
  const value = name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').trim().slice(0, 140);
  return !value || /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(value) ? `aula-${value || 'sem-titulo'}` : value;
}
function requestHeaders(url, captures, fallback) {
  // Never forward credentials captured on another origin.
  const origin = new URL(url).origin;
  const source = captures.get(url) || [...captures].reverse().find(([u]) => new URL(u).origin === origin)?.[1] || {};
  const result = { 'user-agent': fallback };
  for (const [key, value] of Object.entries(source)) {
    if (['authorization', 'referer', 'origin', 'user-agent'].includes(key) || key.startsWith('x-')) result[key] = value;
  }
  return result;
}

// A local relay keeps browser credentials out of FFmpeg arguments and applies
// cookies per destination. Every redirect is fetched separately, without
// forwarding Authorization to a different origin.
async function makeRelay(context, captures, userAgent, chosen) {
  const routes = new Map();
  const ids = new Map();
  const secret = randomBytes(18).toString('hex');
  let root;
  function local(url) {
    if (!/^https?:$/.test(new URL(url).protocol)) throw new Error('Protocolo de mídia não suportado.');
    if (!ids.has(url)) {
      const id = `${secret}/${ids.size}`;
      ids.set(url, id); routes.set(`/${id}`, url);
    }
    return `${root}/${ids.get(url)}`;
  }
  async function fetchRemote(url, range) {
    for (let i = 0; i < 8; i++) {
      const headers = requestHeaders(url, captures, userAgent);
      if (range) headers.range = range;
      const response = await context.request.get(url, { headers, maxRedirects: 0, timeout: 60000 });
      if ([301, 302, 303, 307, 308].includes(response.status())) {
        const location = response.headers().location;
        await response.dispose();
        if (!location) throw new Error('Redirecionamento sem destino.');
        url = new URL(location, url).href;
        if (!/^https?:$/.test(new URL(url).protocol)) throw new Error('Redirecionamento inválido.');
        continue;
      }
      return { response, url };
    }
    throw new Error('Excesso de redirecionamentos.');
  }
  const server = http.createServer(async (req, res) => {
    const remote = routes.get(req.url);
    if (!remote) { res.writeHead(404).end(); return; }
    let response;
    try {
      const fetched = await fetchRemote(remote, req.headers.range);
      response = fetched.response;
      if (!response.ok()) throw new Error(`Servidor respondeu HTTP ${response.status()}.`);
      let body = await response.body();
      const headers = response.headers();
      const outputHeaders = {};
      if (body.subarray(0, 64).toString().trimStart().startsWith('#EXTM3U')) {
        body = Buffer.from(rewrite(body.toString(), fetched.url, local, remote === chosen.url ? chosen.variant : null));
        outputHeaders['content-type'] = 'application/vnd.apple.mpegurl';
      } else {
        for (const key of ['content-type', 'content-range', 'accept-ranges']) if (headers[key]) outputHeaders[key] = headers[key];
      }
      res.writeHead(response.status(), { ...outputHeaders, 'content-length': body.length });
      res.end(body);
    } catch (error) {
      // Do not print network exceptions: they can include signed URLs.
      console.error('Falha ao obter mídia autenticada. Verifique a sessão e o acesso à aula.');
      res.writeHead(502).end();
    } finally { if (response) await response.dispose(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  root = `http://127.0.0.1:${server.address().port}`;
  return { input: local(chosen.url), close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}
async function download(input, target, hls) {
  const args = ['-hide_banner', '-loglevel', 'info', '-nostats', '-progress', 'pipe:1', '-stats_period', '1', '-nostdin', '-n'];
  if (hls) args.push('-extension_picky', '0', '-allowed_extensions', 'ALL', '-allowed_segment_extensions', 'ALL');
  args.push('-i', input, '-map', '0:v:0', '-map', '0:a:0?', '-c', 'copy', '-movflags', '+faststart', target);
  await new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let errors = '';
    let duration = 0, elapsed = 0, buffer = '', lastPercent = -1;
    const showProgress = () => {
      if (!(duration > 0)) return;
      const percent = Math.max(lastPercent, Math.min(99, Math.max(0, Math.floor(elapsed / duration * 100))));
      if (percent === lastPercent) return;
      lastPercent = percent;
      process.stdout.write(`\rBaixando: ${percent}%   `);
    };
    process.stdout.write('Preparando download...');
    proc.stderr.on('data', chunk => {
      errors = (errors + chunk).slice(-8000);
      if (!duration) {
        const match = errors.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
        if (match) { duration = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]); showProgress(); }
      }
    });
    proc.stdout.on('data', chunk => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) {
        if (line.startsWith('out_time_us=')) {
          const value = Number(line.slice('out_time_us='.length));
          if (Number.isFinite(value)) elapsed = Math.max(0, value / 1000000);
        }
        if (line.startsWith('progress=')) {
          showProgress();
          if (!duration) process.stdout.write(`\rBaixando: ${Math.floor(elapsed)} s processados (duração total indisponível)   `);
        }
      }
    });
    proc.on('error', () => reject(new Error('Não foi possível iniciar o FFmpeg. Verifique a instalação.')));
    proc.on('close', code => {
      process.stdout.write(code === 0 ? '\rBaixando: 100% — finalizado.                  \n' : '\n');
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg falhou (${code}). ${errors.replace(/https?:\/\/[^\s"']+/g, '[URL ocultada]')}`));
    });
  });
}
async function main() {
  const pageUrl = process.argv[2];
  if (!pageUrl || !/^https?:\/\//i.test(pageUrl)) throw new Error('Uso: node downloader.js "URL_DA_PAGINA_DA_AULA"');
  const { chromium } = require('playwright');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let context, relay;
  try {
    context = await chromium.launchPersistentContext(path.join(__dirname, 'perfil-chrome'), {
      channel: 'chrome', headless: false, args: ['--start-maximized'] });
    const captures = new Map(), candidates = new Map(), pending = new Set();
    context.on('request', request => {
      const job = request.allHeaders().then(headers => {
        if (/^https?:/.test(request.url())) captures.set(request.url(), headers);
      }).catch(() => {}).finally(() => pending.delete(job));
      pending.add(job);
    });
    context.on('response', response => {
      const job = (async () => {
        if (!response.ok() || !isMedia(response.url(), response.headers()['content-type'])) return;
        const hls = /mpegurl/i.test(response.headers()['content-type'] || '') || /\.m3u8$/i.test(new URL(response.url()).pathname);
        const text = hls ? await response.text() : '';
        if (hls && !text.trimStart().startsWith('#EXTM3U')) return;
        candidates.set(response.url(), { url: response.url(), hls, text, variant: hls ? variants(text, response.url())[0] : null });
      })().catch(() => {}).finally(() => pending.delete(job));
      pending.add(job);
    });
    const page = context.pages()[0] || await context.newPage();
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    let chosen;
    while (!chosen) {
      await rl.question('\nFaça login, abra a aula e dê play. Quando o vídeo estiver tocando, pressione ENTER aqui. ');
      await Promise.allSettled([...pending]);
      const options = [...candidates.values()].sort((a, b) => (b.variant?.height || 0) - (a.variant?.height || 0));
      if (!options.length) { console.log('Nenhuma playlist ou MP4 detectado. Dê play ou recarregue a aula e tente novamente.'); continue; }
      options.forEach((o, i) => console.log(`[${i + 1}] ${o.hls ? 'HLS' : 'MP4'} — ${o.variant ? `${o.variant.height || '?'}p (melhor resolução da playlist)` : 'resolução não informada'} — ${new URL(o.url).hostname}`));
      const answer = (await rl.question('Escolha o vídeo [1] ou R para capturar novamente: ')).trim();
      if (answer.toLowerCase() === 'r') { candidates.clear(); continue; }
      chosen = options[Number(answer || '1') - 1];
    }
    if (protectedPlaylist(chosen.text)) throw new Error('Playlist com proteção DRM não suportada.');
    const activePage = context.pages().find(p => p.url().includes('aula_id=')) || page;
    let title = await activePage.title();
    for (const selector of ['[class*="lesson-title"]', '[class*="aula-title"]', '[class*="video-title"]', 'h1']) {
      const text = await activePage.locator(selector).first().innerText({ timeout: 500 }).catch(() => '');
      if (text.trim()) { title = text.trim(); break; }
    }
    const folder = path.join(__dirname, 'downloads');
    fs.mkdirSync(folder, { recursive: true });
    let target = path.join(folder, `${safeName(title)}.mp4`);
    for (let n = 2; fs.existsSync(target) || fs.existsSync(target + '.part.mp4'); n++) target = path.join(folder, `${safeName(title)} (${n}).mp4`);
    console.log(`\nDestino: ${target}`);
    if ((await rl.question('Baixar esta aula? [S/N]: ')).trim().toUpperCase() !== 'S') return;
    const userAgent = await page.evaluate(() => navigator.userAgent);
    relay = await makeRelay(context, captures, userAgent, chosen);
    const partial = target + '.part.mp4';
    console.log('Baixando... mantenha esta janela aberta.');
    try { await download(relay.input, partial, chosen.hls); fs.renameSync(partial, target); }
    catch (error) { if (fs.existsSync(partial)) fs.unlinkSync(partial); throw error; }
    console.log(`Download concluído: ${target}`);
  } finally {
    if (relay) await relay.close();
    if (context) await context.close();
    rl.close();
  }
}
module.exports = { attrs, variants, isMedia, protectedPlaylist, rewrite, safeName, requestHeaders, makeRelay, download };
if (require.main === module) main().catch(error => { console.error(String(error.message).replace(/https?:\/\/[^\s"']+/g, '[URL ocultada]')); process.exitCode = 1; });
