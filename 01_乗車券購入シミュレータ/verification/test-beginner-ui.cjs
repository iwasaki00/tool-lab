const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const {pathToFileURL}=require('url');
const cp=require('child_process');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
  const page=await context.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  assert.equal(await page.locator('#section-overview').isVisible(),true);
  assert.equal(await page.locator('[role="tab"]').count(),4);
  assert.equal(await page.locator('[role="tabpanel"]:visible').count(),1);
  assert.equal(await page.locator('#tab-overview').getAttribute('aria-selected'),'true');
  assert.equal(await page.getByText('ツールメニューへ戻る').count(),0);
  assert.equal(await page.locator('#simulate-button').isVisible(),false);
  assert.equal(await page.locator('.result-panel').isVisible(),false);
  for(const section of ['guide','samples','calculate','overview']){
   await page.locator('#tab-'+section).click();
   assert.equal(await page.locator('#section-'+section).isVisible(),true);
   assert.equal(await page.locator('[role="tabpanel"]:visible').count(),1);
   assert.equal(await page.locator('#tab-'+section).getAttribute('aria-selected'),'true');
   assert.equal(await page.locator('#simulate-button').isVisible(),section==='calculate');
  }
  await page.locator('[data-section-link="samples"]').first().click();
  assert.equal(await page.locator('#section-samples').isVisible(),true);
  await page.locator('#tab-overview').click();
  await page.locator('[data-section-link="calculate"]').first().click();
  assert.equal(await page.locator('#section-calculate').isVisible(),true);
  assert.equal(await page.locator('#advanced-settings').getAttribute('open'),null);
  assert.equal(await page.locator('#exclusion-start').isVisible(),false);
  assert.equal(await page.locator('#start-date').isVisible(),true);
  await page.locator('#fare-one-way').fill('700'); await page.locator('#fare-one-way').dispatchEvent('change');
  await page.locator('#start-date').fill('2027-04-01'); await page.locator('#start-date').dispatchEvent('change');
  await page.locator('#end-date').fill('2027-04-30'); await page.locator('#end-date').dispatchEvent('change');
  await page.locator('#advanced-settings > summary').click();
  await page.locator('#exclusion-start').fill('2027-04-12'); await page.locator('#exclusion-end').fill('2027-04-16'); await page.locator('#exclusion-reason').fill('saved vacation'); await page.locator('#add-exclusion').click();
  await page.locator('.calendar-day[data-date="2027-04-03"]').click();
  await page.locator('#simulate-button').click();
  assert.ok(await page.locator('.result-panel').isVisible());
  assert.ok(await page.evaluate(()=>lastResult.bestCost>0));
  const original=await page.evaluate(()=>captureInputState());
  for(const section of ['samples','guide','overview','calculate'])await page.locator('#tab-'+section).click();
  assert.deepEqual(await page.evaluate(()=>captureInputState()),original);
  assert.ok(await page.locator('#advanced-settings').evaluate(e=>e.open));
  assert.ok(await page.locator('.result-panel').isVisible());
  await page.locator('#tab-overview').click();
  await page.locator('#guided-experience').click();
  assert.equal(await page.evaluate(()=>activeSection),'samples');
  assert.equal(await page.evaluate(()=>sampleSession.sample.id),'05');
  assert.equal(await page.locator('.result-panel').isVisible(),true);
  assert.ok((await page.locator('#sample-status').textContent()).includes('月によって出勤日数が変動'));
  assert.ok(await page.locator('#discovery-title').isVisible());
  assert.deepEqual(await page.evaluate(()=>sampleSession.original),original);
  const result05=await page.evaluate(()=>structuredClone(lastResult));
  const previous=JSON.parse(cp.execFileSync('git',['show','8ac7446:01_乗車券購入シミュレータ/verification/sample-results.json'],{encoding:'utf8'})).find(x=>x.id==='05');
  assert.equal(result05.bestCost,previous.cost); assert.deepEqual(result05.flow,previous.flow);
  await page.locator('#restore-settings').click();
  assert.equal(await page.evaluate(()=>activeSection),'calculate');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'tab-calculate');
  assert.deepEqual(await page.evaluate(()=>captureInputState()),original);
  // Reload still starts at overview and retains settings, including an active sample's restoration point.
  await page.locator('#tab-overview').click();await page.locator('#guided-experience').click();await page.reload();
  assert.equal(await page.locator('#section-overview').isVisible(),true);
  await page.locator('#tab-samples').click();await page.locator('#restore-settings').click();
  assert.deepEqual(await page.evaluate(()=>captureInputState()),original);
  // Tab-list keyboard navigation and collapsible help remain available without a mouse.
  await page.locator('#tab-overview').focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#tab-guide').getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('.guide-steps li').count(),3);
  await page.locator('#section-guide summary').focus();await page.keyboard.press('Enter');
  assert.ok(await page.locator('#section-guide details').evaluate(e=>e.open));
  await page.locator('#tab-guide').focus();await page.keyboard.press('End');
  assert.equal(await page.locator('#tab-calculate').getAttribute('aria-selected'),'true');
  await page.keyboard.press('Home');assert.equal(await page.locator('#tab-overview').getAttribute('aria-selected'),'true');
  await page.locator('#tab-calculate').click();
  assert.equal(await page.locator('#fare-one-way').evaluate(e=>getComputedStyle(e).userSelect),'text');
  assert.equal(await page.locator('#tab-calculate').evaluate(e=>getComputedStyle(e).touchAction),'manipulation');
  assert.notEqual(await page.locator('.action-bar').evaluate(e=>getComputedStyle(e).position),'sticky');
  // Focused responsive checks on the four views and the shared result.
  for(const width of [1280,740,390,375,320]){
   await page.setViewportSize({width,height:900});
   for(const section of ['overview','guide','samples','calculate']){
    await page.locator('#tab-'+section).click();
    const overflow=await page.evaluate(()=>({body:document.documentElement.scrollWidth>innerWidth,items:[...document.querySelectorAll('button,input,summary,.panel,.section-menu')].filter(e=>e.getClientRects().length && (e.getBoundingClientRect().right>innerWidth+1||e.getBoundingClientRect().left< -1||e.scrollWidth>e.clientWidth+2)).map(e=>e.id||e.className)}));
    assert.deepEqual(overflow,{body:false,items:[]},`${section} width=${width}`);
    for(const tab of await page.locator('[role="tab"]').all())assert.ok((await tab.boundingBox()).height>=44);
    if(width===1280||width===390){await page.screenshot({path:`verification/v120-${width}-${section}.png`,fullPage:true})}
   }
  }
  // CSV/PDF data from a manually calculated result still include current amounts and flow.
  await page.locator('#simulate-button').click();
  const result=await page.evaluate(()=>lastResult);
  const pending=page.waitForEvent('download');await page.locator('#download-csv').click();const download=await pending;
  assert.ok(fs.readFileSync(await download.path(),'utf8').includes(String(result.bestCost)));
  const pdf=await page.evaluate(()=>{let html='';const saved=window.open;window.open=()=>({document:{open(){},write(s){html=s},close(){}}});downloadPdf();window.open=saved;return html});
  assert.ok(pdf.includes(result.flow[0].startDate));
  assert.ok(pdf.includes(new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0}).format(result.bestCost)));
  await page.locator('[data-flow-view="gantt"]').click();assert.ok(await page.locator('.gantt-wrap').isVisible());
  await page.locator('[data-flow-view="calendar"]').click();assert.ok(await page.locator('.flow-calendar-grid').isVisible());
  assert.ok((await page.locator('#manual-result-method').textContent()).includes(await page.evaluate(()=>getPurchaseMethod(lastResult))));
  const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:'reduce'});
  const mobile=await touch.newPage();mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(pathToFileURL(path.resolve('index.html')).href);
  await mobile.locator('#guided-experience').tap();
  await mobile.waitForFunction(()=>{const r=document.getElementById('restore-settings').getBoundingClientRect();return r.top>=document.querySelector('.app-header').getBoundingClientRect().bottom && r.bottom<innerHeight});
  await mobile.screenshot({path:'verification/v120-iphone-guided.png'});
  assert.equal(await mobile.locator('#simulate-button').isVisible(),false);
  await mobile.locator('#tab-calculate').tap();await mobile.locator('#advanced-settings > summary').tap();
  assert.ok(await mobile.locator('#exclusion-start').isVisible());
  await mobile.locator('#fare-one-way').fill('710');await mobile.locator('#fare-one-way').dispatchEvent('change');
  await mobile.locator('#tab-guide').tap();await mobile.locator('#tab-calculate').tap();
  assert.equal(await mobile.locator('#fare-one-way').inputValue(),'710');
  assert.ok((await mobile.locator('#sample-status').textContent()).includes('変更済み'));
  await mobile.locator('#restore-settings').tap();
  assert.equal(await mobile.locator('#fare-one-way').inputValue(),'633');
  assert.equal(await mobile.locator('#restore-settings').isVisible(),false);
  await touch.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: all 12 v1.2.0 checks; keyboard navigation, details, same v1.1.0 guided result; 1280/740/390/375/320px');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
