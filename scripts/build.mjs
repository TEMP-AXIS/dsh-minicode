#!/usr/bin/env node
// Crawl the MiniWorld UGC wiki and write the compact JSON index shipped with this
// bundle.  The crawling itself lives in ../lib/crawl.mjs so the Settings page can
// run exactly the same code inside the DSH host process.
//
//   node scripts/build.mjs                  # crawl the live site
//   node scripts/build.mjs --offline        # rebuild from _probe/pages/*.html
//   node scripts/build.mjs --out data/x.json
import { crawlWiki, writeIndex } from '../lib/crawl.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf('--' + name);
  if (i < 0) return fallback;
  const next = args[i + 1];
  return next && !next.startsWith('--') ? next : true;
};
const OFFLINE = args.includes('--offline');
const OUT = flag('out', 'data/ugc-wiki.json');
const CACHE = flag('cache', '_probe/pages');
const HOME = flag('home', '_probe/home.html');

const log = (...a) => console.error(...a);

crawlWiki({
  offline: OFFLINE,
  cacheDir: CACHE,
  homeFile: HOME,
  concurrency: 4,
  log: log,
})
  .then(async (result) => {
    const bytes = await writeIndex(OUT, result.index);
    log('wrote', OUT, (bytes / 1024).toFixed(0) + ' KiB', JSON.stringify(result.index.meta.counts));
    if (result.failures.length) log('failed pages:', JSON.stringify(result.failures));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });