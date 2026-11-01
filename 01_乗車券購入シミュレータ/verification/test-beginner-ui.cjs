const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('path');
const {pathToFileURL}=require('url');
const {loadSample,openManual}=require('./ui-helpers.cjs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  const page=await context.newPage();await page.clock.install({time:new Date('2026-11-01T01:00:00Z')});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  assert.equal(await page.locator('#section-overview').isVisible(),true);
  assert.equal(await page.locator('[role="tab"]').count(),4);
  assert.equal(await page.locator('#guided-experience').count(),0);
  assert.equal(await page.getByText('おまかせ体験').count(),0);
  assert.equal(await page.getByText('CSV',{exact:false}).count(),0);
  assert.equal(await page.locator('#download-csv').count(),0);
  assert.equal(await page.locator('#simulate-button').isVisible(),false);
  assert.equal((await page.locator('#tab-calculate').textContent()).trim(),'シミュレート実行');
  for(const section of ['guide','samples','calculate','overview']){
   await page.locator('#tab-'+section).click();assert.ok(await page.locator('#section-'+section).isVisible());
   assert.equal(await page.locator('[role="tabpanel"]:visible').count(),1);
   assert.equal(await page.locator('#tab-'+section).getAttribute('aria-selected'),'true');
   assert.equal(await page.locator('#simulate-button').isVisible(),section==='calculate');
  }
  await page.locator('#section-overview [data-section-link="samples"]').click();
  assert.equal(await page.locator('.sample-conditions:visible').count(),0);
  const original=await page.evaluate(()=>captureInputState());
  await page.locator('[data-sample="01"]').click();
  assert.equal(await page.locator('.sample-conditions:visible').count(),1);
  assert.deepEqual(await page.evaluate(()=>captureInputState()),original);
  assert.equal(await page.evaluate(()=>sampleSession),null);
  await page.locator('[data-sample="02"]').click();
  assert.equal(await page.locator('#sample-conditions-01').isVisible(),false);
  assert.equal(await page.locator('#sample-conditions-02').isVisible(),true);
  await page.locator('[data-sample="02"]').click();assert.equal(await page.locator('.sample-conditions:visible').count(),0);
  await page.locator('#tab-overview').click();await page.locator('#section-overview [data-section-link="calculate"]').click();
  assert.ok(await page.locator('#section-calculate').isVisible());
  assert.equal(await page.locator('#advanced-settings').getAttribute('open'),null);
  await page.locator('#fare-one-way').fill('700');await page.locator('#fare-one-way').dispatchEvent('change');
  const edited=await page.evaluate(()=>captureInputState());
  for(const section of ['guide','samples','overview','calculate'])await page.locator('#tab-'+section).click();
  assert.deepEqual(await page.evaluate(()=>captureInputState()),edited);
  await loadSample(page,'02');assert.ok(await page.locator('#sample-context').isVisible());
  assert.ok((await page.locator('#sample-status').textContent()).includes('サンプルの条件を設定しました'));
  assert.equal(await page.locator('.result-panel').isVisible(),false);
  await page.locator('#simulate-button').click();assert.ok(await page.locator('#discovery-title').isVisible());
  assert.equal(await page.locator('#pdf-pattern option').count(),5);
  assert.ok((await page.locator('#pdf-pattern option').first().textContent()).includes('41,450円'));
  await page.locator('#restore-settings').click();assert.deepEqual(await page.evaluate(()=>captureInputState()),edited);
  assert.equal(await page.locator('#sample-context').isVisible(),false);
  // Precise errors next to invalid inputs; stale output is unavailable.
  await page.locator('#fare-one-way').fill('-1');await page.locator('#simulate-button').click();
  assert.ok(await page.locator('#fare-one-way-error').isVisible());assert.equal(await page.locator('#fare-one-way').getAttribute('aria-invalid'),'true');
  await page.locator('#fare-one-way').fill('700');await page.locator('#simulate-button').click();assert.ok(await page.locator('.result-panel').isVisible());
  await page.locator('#end-date').fill('2020-01-01');await page.locator('#simulate-button').click();assert.ok(await page.locator('#date-error').isVisible());
  assert.equal(await page.locator('.result-panel').isVisible(),false);assert.equal(await page.locator('#download-pdf').isDisabled(),true);
  await loadSample(page,'05');
  await page.locator('#fare-one-way').fill('');await page.locator('#simulate-button').click();assert.ok(await page.locator('#fare-one-way-error').isVisible());
  await page.locator('#fare-one-way').fill('633');
  await openManual(page,true);for(const id of ['use-rtt','use-cmt1m','use-cmt3m','use-cmt6m'])await page.locator('#'+id).uncheck();
  await page.locator('#simulate-button').click();assert.ok(await page.locator('#pattern-error').isVisible());
  await loadSample(page,'05');for(const weekday of await page.locator('input[name="weekday"]').all())await weekday.uncheck();
  await page.locator('#simulate-button').click();assert.ok(await page.locator('#date-error').isVisible());
  await loadSample(page,'05');await page.locator('#simulate-button').click();
  await openManual(page,true);await page.locator('#use-cmt6m').uncheck();await page.locator('#simulate-button').click();
  // Export comparisons still include all 4 reference-only costs, as the original comparison engine does.
  assert.equal(await page.locator('#pdf-pattern option').count(),5);
  assert.ok((await page.locator('.summary-grid').textContent()).includes('参考額（最安探索の対象外）'));
  await page.locator('[data-flow-view="gantt"]').click();assert.ok(await page.locator('.gantt-wrap').isVisible());
  await page.locator('[data-flow-view="calendar"]').click();assert.ok(await page.locator('.flow-calendar-grid').isVisible());
  await page.locator('#tab-overview').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#tab-guide').getAttribute('aria-selected'),'true');
  await page.locator('#section-guide summary').focus();await page.keyboard.press('Enter');assert.ok(await page.locator('#section-guide details').evaluate(e=>e.open));
  await page.locator('#tab-guide').focus();await page.keyboard.press('End');assert.equal(await page.locator('#tab-calculate').getAttribute('aria-selected'),'true');
  // External links are explicit and cannot replace the current input page.
  await page.locator('.fare-help summary').click();
  for(const [href,text]of [['https://www.jorudan.co.jp/norikae/teiki.html','ジョルダン'],['https://transit.yahoo.co.jp/','Yahoo!']]){
   const link=page.locator('a[href="'+href+'"]');assert.equal(await link.getAttribute('target'),'_blank');assert.ok((await link.getAttribute('rel')).includes('noopener'));assert.ok((await link.textContent()).includes(text));
  }
  const beforeLink=await page.locator('#fare-one-way').inputValue();
  await context.route('https://www.jorudan.co.jp/norikae/teiki.html',route=>route.fulfill({body:'<title>External link test</title>'}));
  const popupPromise=page.waitForEvent('popup');await page.locator('a[href="https://www.jorudan.co.jp/norikae/teiki.html"]').click();const popup=await popupPromise;await popup.close();
  assert.equal(await page.locator('#fare-one-way').inputValue(),beforeLink);
  for(const width of [1280,740,390,375,320]){
   await page.setViewportSize({width,height:900});
   for(const section of ['overview','guide','samples','calculate']){
    await page.locator('#tab-'+section).click();
    const overflow=await page.evaluate(()=>({body:document.documentElement.scrollWidth>innerWidth,items:[...document.querySelectorAll('button,input,select,summary,.panel,.sample-item,.sample-conditions')].filter(e=>e.getClientRects().length&&(e.getBoundingClientRect().right>innerWidth+1||e.getBoundingClientRect().left< -1||e.scrollWidth>e.clientWidth+2)).map(e=>e.id||e.className)}));
    assert.deepEqual(overflow,{body:false,items:[]},`${section} width=${width}`);
    for(const tab of await page.locator('[role="tab"]').all())assert.ok((await tab.boundingBox()).height>=44);
    if(width===1280||width===390)await page.screenshot({path:`verification/v124-${width}-${section}.png`,fullPage:true});
   }
  }
  const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const mobile=await touch.newPage();mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(pathToFileURL(path.resolve('index.html')).href);
  await mobile.locator('#tab-samples').tap();await mobile.locator('[data-sample="06"]').tap();
  assert.equal(await mobile.evaluate(()=>lastResult),null);await mobile.screenshot({path:'verification/v124-iphone-preview.png'});
  await mobile.locator('[data-apply-sample="06"]').tap();assert.equal(await mobile.evaluate(()=>activeSection),'calculate');
  await mobile.screenshot({path:'verification/v124-iphone-loaded.png'});
  await mobile.locator('#simulate-button').tap();await mobile.waitForFunction(()=>{const r=document.getElementById('result-title').getBoundingClientRect();return r.top>=document.querySelector('.app-header').getBoundingClientRect().bottom&&r.top<innerHeight});
  await mobile.screenshot({path:'verification/v124-iphone-result.png'});
  await mobile.locator('#tab-calculate').tap();await mobile.locator('#fare-one-way').fill('710');await mobile.locator('#fare-one-way').dispatchEvent('change');
  assert.equal(await mobile.locator('.result-panel').isVisible(),false);assert.equal(await mobile.locator('#download-pdf').isDisabled(),true);
  assert.ok((await mobile.locator('#sample-status').textContent()).includes('変更済み'));await mobile.locator('#restore-settings').tap();
  assert.equal(await mobile.locator('#sample-context').isVisible(),false);await touch.close();assert.deepEqual(errors,[]);
  console.log('PASS UI: guided preview/load/execute, no automatic calculation/CSV/surprise, validation, keyboard, links, 5 widths, touch');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
