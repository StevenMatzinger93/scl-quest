// Bedienkomfort-Test: Rundgang, Schnellkorrektur, Hover, Diagnose, Vergleich, Handbuch-Suche, Glossar, Wiederholen, Themes, Handy-Leiste, Offline
const fs0 = require('fs'); fs0.mkdirSync(__dirname + '/shots', { recursive:true });
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport:{ width:1440, height:900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if(m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  let external = 0;
  await page.route(/^https?:\/\//, r => { external++; r.abort(); });   // komplett offline
  await page.goto('file://' + path.join(__dirname, '..', '..', 'index.html'));
  await page.waitForTimeout(300);
  await page.click('#newGameBtn');
  const R = {};
  const first = await page.evaluate(() => SCLQuest.TASKS[0].id);
  await page.evaluate(id => { document.getElementById('levelIntroOverlay').style.display='none'; document.getElementById('app').style.display=''; SCLQuest.renderTask(SCLQuest.TASKS.find(t => t.id === id), false); }, first);
  await page.waitForTimeout(900);
  R.tour = await page.evaluate(() => getComputedStyle(document.getElementById('tourOverlay')).display !== 'none');
  await page.screenshot({ path:__dirname + '/shots/ux_tour.png' });
  for(let i = 0; i < 10; i++){ const vis = await page.evaluate(() => getComputedStyle(document.getElementById('tourOverlay')).display !== 'none'); if(!vis) break; await page.click('#tourNext'); await page.waitForTimeout(120); }
  R.tourDone = await page.evaluate(() => !!(SCLQuest.state.tours || {}).basic);
  R.gloss = await page.evaluate(() => document.querySelectorAll('#taskDescription .gl, #storyText .gl, #learnGoal .gl').length);
  // Schnellkorrektur: "=" statt ":="
  const t0 = await page.evaluate(() => { const t = SCLQuest.session.task; const v = Object.keys(t.initialVars)[0]; return { v, val: t.initialVars[v] }; });
  const lit = typeof t0.val === 'boolean' ? 'TRUE' : '1';
  await page.evaluate(([v, lit]) => { SCLQuest.editor.setValue(v + ' = ' + lit + ';'); SCLQuest.compile(); }, [t0.v, lit]);
  await page.waitForTimeout(200);
  R.qfEq = await page.evaluate(() => !!document.getElementById('quickFixBtn'));
  R.squiggle = await page.evaluate(() => !!document.querySelector('#editorHighlight .tok-err'));
  if(R.qfEq){ await page.click('#quickFixBtn'); R.qfEqRes = await page.evaluate(() => SCLQuest.editor.getValue()); }
  // Tippfehler → Vorschlag
  await page.evaluate(([v, lit]) => { SCLQuest.editor.setValue(v.slice(0, -1) + 'x := ' + lit + ';'); SCLQuest.compile(); }, [t0.v, lit]);
  await page.waitForTimeout(150);
  R.qfSug = await page.evaluate(() => { const b = document.getElementById('quickFixBtn'); return b ? b.textContent : null; });
  if(R.qfSug){ await page.click('#quickFixBtn'); R.qfSugRes = await page.evaluate(() => SCLQuest.editor.getValue()); }
  // Semikolon
  await page.evaluate(([v, lit]) => { SCLQuest.editor.setValue(v + ' := ' + lit + '\n' + v + ' := ' + lit + ';'); SCLQuest.compile(); }, [t0.v, lit]);
  await page.waitForTimeout(150);
  if(await page.$('#quickFixBtn')){ await page.click('#quickFixBtn'); R.qfSemi = await page.evaluate(() => SCLQuest.editor.getValue().split('\n')[0]); }
  // Hover über Variable
  await page.evaluate(([v, lit]) => { SCLQuest.editor.setValue(v + ' := ' + lit + ';'); }, [t0.v, lit]);
  const box = await page.$eval('#codeEditor', e => { const r = e.getBoundingClientRect(); const st = getComputedStyle(e); return { x: r.left + parseFloat(st.paddingLeft) + 12, y: r.top + parseFloat(st.paddingTop) + 8 }; });
  await page.mouse.move(box.x, box.y); await page.mouse.move(box.x + 2, box.y + 1);
  await page.waitForTimeout(500);
  R.hover = await page.evaluate(() => { const t = document.getElementById('hoverTip'); return t.style.display !== 'none' ? t.textContent.slice(0, 80) : null; });
  await page.mouse.move(5, 5);
  // Diagnose: Profi-Debug (TEMP-Zähler)
  await page.evaluate(() => { SCLQuest.renderTask(SCLQuest.TASKS.find(t => t.id === 'p11_temp_dbg'), true); });
  await page.waitForTimeout(700);
  for(let i = 0; i < 8; i++){ const vis = await page.evaluate(() => getComputedStyle(document.getElementById('tourOverlay')).display !== 'none'); if(!vis) break; await page.click('#tourNext'); await page.waitForTimeout(100); }
  await page.evaluate(() => SCLQuest.compile()); await page.waitForTimeout(200);
  R.diag = await page.evaluate(() => { const d = document.querySelector('.diag-box'); return d ? d.innerText.slice(0, 160) : null; });
  // v4-Zähler ohne Flanke
  const cnt = await page.evaluate(() => { const t = SCLQuest.TASKS.find(t => t._wrong && /Flanke|zähl/i.test(t.title + t.briefing) && t.timedTestCases); if(!t) return null; SCLQuest.renderTask(t, true); SCLQuest.editor.setValue(t._wrong[0]); SCLQuest.compile(); const d = document.querySelector('.diag-box'); return t.id + ': ' + (d ? d.innerText.slice(0, 200) : 'keine Diagnose'); });
  R.diagCount = cnt;
  // Lösungsvergleich
  await page.evaluate(() => { const t = SCLQuest.TASKS.find(t => t.id === 'p12_erste_fc'); SCLQuest.renderTask(t, true); SCLQuest.setProCodes({ FC_Max3: ProTask.refCodes(t).FC_Max3.replace('#FC_Max3 := #a;', '#FC_Max3 := #a;   // Start mit a') }); SCLQuest.compile(); });
  await page.waitForSelector('#successCmpBtn', { timeout:5000 });
  await page.waitForTimeout(1500);
  await page.click('#successCmpBtn');
  R.diff = await page.evaluate(() => ({ open: document.getElementById('diffModal').classList.contains('active'), lines: document.querySelectorAll('.dl').length, same: !!document.querySelector('.diff-same') }));
  await page.screenshot({ path:__dirname + '/shots/ux_diff.png' });
  await page.keyboard.press('Escape');
  // Handbuch-Suche
  await page.click('#openManualBtn'); await page.fill('#manualSearch', 'Flanke'); await page.waitForTimeout(200);
  R.manual = await page.evaluate(() => ({ hits: document.getElementById('manualHits').textContent, marks: document.querySelectorAll('#manualContent mark').length, glossar: !!document.querySelector('[data-id=glossar]') }));
  await page.keyboard.press('Escape');
  // Wiederholen
  await page.evaluate(() => { const s = SCLQuest.state; const ids = SCLQuest.TASKS.slice(3, 6).map(t => t.id); ids.forEach((id, i) => s.doneTasks[id] = { stars: 1 + (i % 2), points: 50, fails: 3, hints: 1, at: Date.now() - 5 * 86400000 }); });
  await page.click('#openMapBtn'); await page.waitForTimeout(200);
  R.review = await page.evaluate(() => document.querySelectorAll('.review-chip').length);
  await page.screenshot({ path:__dirname + '/shots/ux_map.png' });
  await page.keyboard.press('Escape');
  // Speicheranzeige
  R.saved = await page.evaluate(() => document.getElementById('saveIndicator').textContent.trim());
  // Helles Schema + Farbsicht
  await page.evaluate(() => { SCLQuest.state.settings.theme = 'light'; SCLQuest.state.settings.cb = true; document.getElementById('setTheme').value = 'light'; document.getElementById('setTheme').dispatchEvent(new Event('change')); document.getElementById('setCb').checked = true; document.getElementById('setCb').dispatchEvent(new Event('change')); SCLQuest.renderTask(SCLQuest.TASKS.find(t => t.id === 'p13_boss'), true); });
  await page.waitForTimeout(400);
  await page.screenshot({ path:__dirname + '/shots/ux_light.png' });
  // 3D offline
  await page.click('#viewBtn3d'); await page.waitForTimeout(800);
  R.three = await page.evaluate(() => getComputedStyle(document.getElementById('scene3dWrap')).display !== 'none');
  await page.click('#viewBtn2d');
  R.external = external;
  console.log(JSON.stringify(R, null, 1));
  // Handy: Symbolleiste
  const m = await browser.newContext({ viewport:{ width:390, height:844 }, deviceScaleFactor:2, hasTouch:true });
  const mp = await m.newPage(); await mp.route(/^https?:\/\//, r => r.abort());
  await mp.goto('file://' + path.join(__dirname, '..', '..', 'index.html')); await mp.click('#newGameBtn');
  await mp.evaluate(() => { document.getElementById('levelIntroOverlay').style.display='none'; document.getElementById('app').style.display=''; SCLQuest.state.tours = { basic:true, pro:true }; SCLQuest.renderTask(SCLQuest.TASKS[2], false); SCLQuest.editor.setValue('x'); });
  const sb = await mp.$('#symBar'); await sb.scrollIntoViewIfNeeded();
  await mp.focus('#codeEditor'); await mp.evaluate(() => { const ta = document.getElementById('codeEditor'); ta.selectionStart = ta.selectionEnd = 1; });
  await mp.click('#symBar [data-ins=":= "]'); await mp.click('#symBar [data-ins="TRUE"]'); await mp.click('#symBar [data-ins=";"]');
  console.log('symBar', await mp.evaluate(() => [getComputedStyle(document.getElementById('symBar')).display, SCLQuest.editor.getValue()]));
  await mp.screenshot({ path:__dirname + '/shots/ux_mobile.png' });
  console.log(errors.join('\n') || 'keine JS-Fehler');
  await browser.close();
})();
