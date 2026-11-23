const { test } = require('node:test');
const assert = require('node:assert/strict');
const d = require('./downloader');
const master = '#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",URI="audio/list.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=1280x720\n720p/video.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1920x1080,AUDIO="audio"\n1080p/video.m3u8\n';
test('resolves and ranks actual playlist resolutions', () => {
 const v = d.variants(master, 'https://media.test/course/playlist.m3u8?token=secret');
 assert.equal(v[0].height, 1080); assert.equal(v[0].url, 'https://media.test/course/1080p/video.m3u8');
});
test('rejects segments and incidental video names', () => {
 for (const url of ['https://x.test/video0.ts','https://x.test/video/analytics','https://x.test/foo?1080p=1']) assert.equal(d.isMedia(url), false);
 assert.equal(d.isMedia('https://x.test/playlist.m3u8?token=1'), true);
 assert.equal(d.isMedia('https://x.test/opaque', 'application/vnd.apple.mpegurl'), true);
});
test('retains separate audio and rewrites segment/key URIs', () => {
 const v = d.variants(master, 'https://x.test/p/master.m3u8')[0];
 const text = d.rewrite(master, 'https://x.test/p/master.m3u8', u => 'LOCAL:' + u, v);
 assert.ok(text.includes('audio/list.m3u8')); assert.ok(text.includes('1080p/video.m3u8')); assert.ok(!text.includes('720p/video.m3u8'));
 assert.ok(d.rewrite('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key"\nseg.ts', 'https://x.test/p/list.m3u8', u => 'LOCAL:' + u).includes('URI="LOCAL:https://x.test/p/key"'));
});
test('does not propagate authorization across origins', () => {
 const captures = new Map([['https://a.test/list', { authorization: 'secret', cookie: 'session=secret', referer: 'https://page.test/' }]]);
 assert.equal(d.requestHeaders('https://a.test/seg', captures, 'UA').authorization, 'secret');
 assert.equal(d.requestHeaders('https://b.test/seg', captures, 'UA').authorization, undefined);
 assert.equal(d.requestHeaders('https://a.test/seg', captures, 'UA').cookie, undefined);
});
test('detects unsupported protection and sanitizes filenames', () => {
 assert.throws(() => d.rewrite('#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES,URI="key"', 'https://x.test/', x => x));
 assert.equal(d.safeName('CON'), 'aula-CON'); assert.equal(d.safeName('Aula: 1?'), 'Aula_ 1_');
});
