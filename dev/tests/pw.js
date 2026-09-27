const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const THREE_JS = fs.readFileSync(require.resolve('three/build/three.min.js'));
const FA_DIR = path.dirname(require.resolve('@fortawesome/fontawesome-free/package.json'));
async function open(opts){
  opts = opts || {};
  const browser = await chromium.launch({ args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: opts.viewport || { width:1440, height:900 }, deviceScaleFactor: opts.dpr || 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack||'').split('\n').slice(0,3).join('\n')));
  page.on('console', m => { if(m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  await page.route('**/three.min.js', r => r.fulfill({ body: THREE_JS, contentType:'application/javascript' }));
  await page.route('**/font-awesome/**/all.min.css', r => r.fulfill({ body: fs.readFileSync(path.join(FA_DIR,'css/all.min.css'),'utf8').replace(/\.\.\/webfonts\//g, 'https://fa.local/webfonts/'), contentType:'text/css' }));
  await page.route('https://fa.local/webfonts/**', r => { const f = r.request().url().split('/').pop(); r.fulfill({ body: fs.readFileSync(path.join(FA_DIR,'webfonts',f)) }); });
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ body:'', contentType:'text/css' }));
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
  await page.goto('file://' + path.join(__dirname, '..', '..', opts.file || 'index.html'));
  await page.waitForTimeout(400);
  return { browser, page, errors };
}
module.exports = { open };
