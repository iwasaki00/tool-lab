const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('url');
const path = require('path');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
 const page=await context.newPage(); const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 const openManual=async()=>{await page.locator('#tab-calculate').click();await page.locator('#advanced-settings').evaluate(e=>e.open=true)};
 const chooseSample=async(id)=>{await page.locator('#tab-samples').click();await page.locator('[data-sample="'+id+'"]').click()};
 await openManual();
 // Original manual settings: changed fares, all weekday combinations, exclusions, draft form, override, existing result.
 await page.locator('#fare-one-way').fill('720'); await page.locator('#fare-one-way').dispatchEvent('change');
 await page.locator('#start-date').fill('2027-03-01'); await page.locator('#start-date').dispatchEvent('change');
 await page.locator('#end-date').fill('2027-05-31'); await page.locator('#end-date').dispatchEvent('change');
 await page.locator('#exclusion-start').fill('2027-04-05'); await page.locator('#exclusion-end').fill('2027-04-12'); await page.locator('#exclusion-reason').fill('original vacation'); await page.locator('#add-exclusion').click();
 await page.locator('.calendar-day[data-date="2027-03-06"]').click();
 await page.locator('#exclusion-reason').fill('unfinished draft');
 await page.locator('#simulate-button').click();
 const original=await page.evaluate(()=>captureInputState());
 await chooseSample('02');
 const backup=await page.evaluate(()=>sampleSession.original); assert.deepEqual(backup,original);
 assert.equal(await page.locator('.exclusion-item').count(),2);
 await chooseSample('04');
 assert.equal(await page.locator('.exclusion-item').count(),0);
 assert.equal(await page.locator('#exclusion-reason').inputValue(),'');
 assert.equal(await page.evaluate(()=>dateNodes.some(d=>d.exclusionReason)),false);
 assert.equal(await page.evaluate(()=>dateNodes.some(d=>d.enabled!==d.defaultEnabled)),false);
 assert.deepEqual(await page.evaluate(()=>sampleSession.original),original);
 // Changed state clears stale result and export; subsequent simulation uses modified inputs.
 await openManual();
 await page.locator('#fare-one-way').fill('700');
 assert.ok((await page.locator('#sample-status').textContent()).includes('変更済み'));
 assert.equal(await page.locator('#download-csv').isDisabled(),true);
 assert.equal(await page.locator('#discovery-title').count(),0);
 await page.locator('#fare-one-way').dispatchEvent('change');
 await page.locator('#simulate-button').click();
 assert.equal(await page.evaluate(()=>lastResult.bestCost),700*2*await page.evaluate(()=>lastResult.activeDates.length));
 assert.ok((await page.locator('#discovery-title').textContent()).includes('変更後'));
 // Session and original survive reload, including actual calendar overrides.
 await page.reload();
 assert.ok((await page.locator('#sample-status').textContent()).includes('変更済み'));
 await page.locator('#tab-calculate').click();
 await page.locator('#restore-settings').click();
 assert.deepEqual(await page.evaluate(()=>captureInputState()),original);
 assert.equal(await page.evaluate(()=>localStorage.getItem(SAMPLE_SESSION_KEY)),null);
 assert.equal(await page.locator('#discovery-title').count(),0);
 // Unmodified sample survives reload, selected identity and individual dates match.
 await chooseSample('07');
 const irregular=await page.evaluate(()=>dateNodes);
 await page.reload(); assert.deepEqual(await page.evaluate(()=>dateNodes),irregular);
 assert.equal(await page.locator('[data-sample="07"]').getAttribute('aria-pressed'),'true');
 await page.locator('#tab-calculate').click();
 await page.locator('#restore-settings').click(); assert.deepEqual(await page.evaluate(()=>captureInputState()),original);
 // Calendar and exclusion actions correctly mark modified; reapplying clears old state.
 await chooseSample('06');
 await openManual();
 await page.locator('.calendar-day[data-date]').first().click();
 assert.ok((await page.locator('#sample-status').textContent()).includes('変更済み'));
 await chooseSample('06'); await openManual(); await page.locator('[data-remove-exclusion]').click();
 assert.ok((await page.locator('#sample-status').textContent()).includes('変更済み'));
 await chooseSample('03');
 assert.equal(await page.locator('.exclusion-item').count(),0);
 // CSV bytes are from the current calculation, not hard-coded sample text.
 const downloadPromise=page.waitForEvent('download'); await page.locator('#download-csv').click();
 const download=await downloadPromise; const csv=fs.readFileSync(await download.path(),'utf8');
 const result=await page.evaluate(()=>lastResult); assert.ok(csv.includes(String(result.bestCost))); assert.ok(csv.includes(result.flow[0].startDate));
 // PDF print-window generation uses current values and flow. Avoid invoking the OS print dialog.
 const printHtml=await page.evaluate(()=>{let html=''; const open=window.open; window.open=()=>({document:{open(){},write(s){html=s},close(){}}}); downloadPdf(); window.open=open; return html;});
 assert.ok(printHtml.includes(result.flow[0].startDate)); assert.ok(printHtml.includes(new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0}).format(result.bestCost)));
 // Same-price comparisons say same amount, without calling zero a saving.
 await page.evaluate(()=>{document.getElementById('fare-cmt6m').value=lastResult.patternOnlyCosts.RTT;simulate()});
 assert.ok((await page.locator('.discovery').textContent()).includes('同額'));
 assert.ok(!(await page.locator('.discovery').textContent()).includes('0円節約'));
 // Disabled ticket types are excluded from discovery comparisons.
 await openManual();
 await page.locator('#use-cmt6m').uncheck(); await page.locator('#simulate-button').click(); assert.equal(await page.locator('.discovery li').count(),3);
 // No active dates and no enabled patterns retain validation, disable exports, clear discovery.
 await page.evaluate(()=>{dateNodes.forEach(n=>n.enabled=false);simulate()});
 assert.equal(await page.locator('.warning').count(),1); assert.equal(await page.locator('#discovery-title').count(),0); assert.equal(await page.locator('#download-pdf').isDisabled(),true);
 await chooseSample('01');
 await page.evaluate(()=>{PATTERNS.forEach(p=>document.getElementById(p.useId).checked=false);simulate()}); assert.equal(await page.locator('.warning').count(),1);
 // Rolling dates, holiday fallback (national and substitute), estimated equinox.
 const dates=await page.evaluate(()=>[new Date(2026,9,31),new Date(2027,7,1),new Date(2030,11,31)].map(now=>({now:formatDate(now),samples:createSamples(now).map(s=>({start:s.start,end:s.end}))})));
 for(const x of dates) for(const s of x.samples){assert.ok(s.start>x.now);assert.ok(s.end>s.start)}
 assert.equal(await page.evaluate(()=>getHolidayName('2028-01-10')),'成人の日');
 assert.equal(await page.evaluate(()=>getHolidayName('2028-09-22')),'秋分の日（推定）');
 assert.equal(await page.evaluate(()=>getHolidayName('2029-02-12')),'振替休日');
 await chooseSample('05');
 fs.mkdirSync('verification',{recursive:true});
 await page.locator('#sample-title').scrollIntoViewIfNeeded(); await page.screenshot({path:'verification/v120-pc-samples.png'});
 await page.evaluate(()=>document.querySelector('.result-panel').scrollIntoView({block:'start',behavior:'instant'})); await page.waitForTimeout(400); await page.screenshot({path:'verification/v120-pc-result.png'});
 // Test actual bounds at iPhone SE, standard iPhone, and a narrow 320px viewport.
 for(const width of [320,375,390]){
  await page.setViewportSize({width,height:844});
  const overflow=await page.evaluate(()=>[...document.querySelectorAll('.sample-card,.sample-panel,.discovery,.flow-calendar-grid')].filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth+1||e.scrollWidth>e.clientWidth+1}).map(e=>e.className));
  assert.deepEqual(overflow,[],`overflow at ${width}`);
 }
 await page.locator('#sample-title').scrollIntoViewIfNeeded(); await page.screenshot({path:'verification/v120-iphone-samples.png'});
 await page.evaluate(()=>document.querySelector('.result-panel').scrollIntoView({block:'start',behavior:'instant'})); await page.waitForTimeout(400); await page.screenshot({path:'verification/v120-iphone-result.png'});
 assert.deepEqual(errors,[]);
 await browser.close();
 console.log('PASS: restore, reload, switches, edits, manual flow, CSV/PDF generation, ties, validation, rolling dates, holiday fallback, responsive bounds');

})().catch(e=>{console.error(e);process.exit(1)});
