const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('fs');const path=require('path');const cp=require('child_process');
const {pathToFileURL}=require('url');const {loadSample,openManual}=require('./ui-helpers.cjs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const url=pathToFileURL(path.resolve('index.html')).href;
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.locator('#tab-samples').click();
  const region=page.locator('#sample-conditions-01');const beforeY=await page.evaluate(()=>scrollY);
  await page.evaluate(()=>document.querySelector('[data-sample="01"]').click());
  await page.waitForTimeout(70);
  const during=await region.evaluate(e=>({height:e.getBoundingClientRect().height,opacity:Number(getComputedStyle(e).opacity),duration:getComputedStyle(e).transitionDuration}));
  await page.waitForTimeout(300);const fullHeight=await region.evaluate(e=>e.getBoundingClientRect().height);
  assert.ok(during.height>0&&during.height<fullHeight);assert.ok(during.opacity>0&&during.opacity<1);assert.ok(during.duration.includes('0.25s'));
  assert.ok(Math.abs(await page.evaluate(()=>scrollY)-beforeY)<2,'visible heading should not cause scrolling');
  await page.evaluate(()=>document.querySelector('[data-sample="01"]').click());await page.waitForTimeout(60);
  assert.ok(await region.evaluate(e=>e.getBoundingClientRect().height)>0,'closing should animate');
  await page.waitForTimeout(300);assert.equal(await region.evaluate(e=>e.getBoundingClientRect().height),0);
  assert.equal(await region.getAttribute('aria-hidden'),'true');assert.equal(await region.evaluate(e=>e.inert),true);
  // Rapid reversals and switches must settle to one open card without residual height.
  await page.evaluate(async()=>{for(const id of ['02','05','02','08','08','07']){document.querySelector('[data-sample="'+id+'"]').click();await new Promise(r=>setTimeout(r,35))}});
  await page.waitForTimeout(700);assert.equal(await page.locator('.sample-conditions.is-open').count(),1);
  assert.equal(await page.locator('[data-sample="07"]').getAttribute('aria-expanded'),'true');
  for(const closed of await page.locator('.sample-conditions:not(.is-open)').all())assert.equal(await closed.evaluate(e=>e.getBoundingClientRect().height),0);
  await page.waitForFunction(()=>{const b=document.querySelector('[data-sample="07"]').getBoundingClientRect();return b.top>=document.querySelector('.app-header').getBoundingClientRect().bottom+7&&b.bottom<=innerHeight});
  await page.evaluate(()=>document.querySelector('[data-sample="08"]').click());await page.waitForTimeout(700);
  await page.waitForFunction(()=>{const b=document.querySelector('[data-sample="08"]').getBoundingClientRect();return b.top>=document.querySelector('.app-header').getBoundingClientRect().bottom+7&&b.bottom<=innerHeight});
  assert.ok(await page.locator('#sample-conditions-08').evaluate(e=>e.getBoundingClientRect().height)>0);
  for(const id of ['01','02','03','04','05','06','07','08']){
   await page.evaluate(id=>{const b=document.querySelector('[data-sample="'+id+'"]');if(b.getAttribute('aria-expanded')!=='true')b.click()},id);await page.waitForTimeout(300);
   assert.ok(await page.locator('#sample-conditions-'+id).evaluate(e=>e.getBoundingClientRect().height)>0);
   await page.evaluate(id=>document.querySelector('[data-sample="'+id+'"]').click(),id);await page.waitForTimeout(300);
   assert.equal(await page.locator('#sample-conditions-'+id).evaluate(e=>e.getBoundingClientRect().height),0);
  }
  assert.equal(await page.locator('.sample-conditions.is-open').count(),0);
  for(const button of await page.locator('[data-apply-sample]').all())assert.equal(await button.getAttribute('tabindex'),'-1');
  const reduced=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const compact=await reduced.newPage();compact.on('pageerror',e=>errors.push(e.message));await compact.goto(url);await compact.locator('#tab-calculate').click();
  const after=await compact.evaluate(()=>({cost:document.querySelector('[aria-labelledby="cost-title"]').getBoundingClientRect().height,dates:document.querySelector('[aria-labelledby="date-title"]').getBoundingClientRect().height,manual:document.getElementById('section-calculate').getBoundingClientRect().height,samples:{}}));
  await compact.locator('#tab-samples').click();
  for(const id of ['01','02','07']){
   await compact.locator('[data-sample="'+id+'"]').click();after.samples[id]=await compact.locator('#sample-conditions-'+id).evaluate(e=>e.getBoundingClientRect().height);
   assert.equal(await compact.locator('#sample-conditions-'+id).evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
  }
  const baseline=JSON.parse(fs.readFileSync('verification/v122-before.json','utf8'));
  for(const key of ['cost','dates','manual'])assert.ok(after[key]<baseline[key],key+' should be shorter');
  for(const id of ['01','02','07'])assert.ok(after.samples[id]<baseline.samples[id],id+' conditions should be shorter');
  const dimensions=[];
  for(const width of [1280,768,740,390,375,320]){
   await compact.setViewportSize({width,height:900});await openManual(compact,true);
   assert.equal(await compact.locator('.cost-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),width>740?4:2);
   assert.equal(await compact.locator('.ticket-options').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),width>740?4:2);
   const dates=await compact.locator('.date-settings input').evaluateAll(es=>es.map(e=>({y:e.getBoundingClientRect().top,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
   assert.ok(Math.abs(dates[0].y-dates[1].y)<1);assert.ok(dates.every(e=>e.width>110&&e.height>=44));
   const leaveDates=await compact.locator('.exclusion-form input[type="date"]').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().top));assert.ok(Math.abs(leaveDates[0]-leaveDates[1])<1);
   const money=compact.locator('.cost-grid input');assert.equal(await money.count(),4);
   for(const input of await money.all()){
    await input.fill('1234567890123456');assert.equal(await input.inputValue(),'1234567890123456');
    const fits=await input.evaluate(e=>{const s=getComputedStyle(e);const c=document.createElement('canvas').getContext('2d');c.font=s.fontWeight+' '+s.fontSize+' '+s.fontFamily;return c.measureText(e.value).width<=e.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight)+0.5});assert.ok(fits,'long integer text should fit');
    assert.equal(await input.getAttribute('inputmode'),'numeric');
   }
   for(const [id,value]of Object.entries({'fare-one-way':'633','fare-cmt1m':'22980','fare-cmt3m':'65500','fare-cmt6m':'124100'})){await compact.locator('#'+id).fill(value);await compact.locator('#'+id).dispatchEvent('change')}
   await compact.locator('#start-date').fill('2028-02-01');await compact.locator('#start-date').dispatchEvent('change');await compact.locator('#end-date').fill('2028-02-29');await compact.locator('#end-date').dispatchEvent('change');
   assert.equal(await compact.locator('#end-date').inputValue(),'2028-02-29');
   const overflow=await compact.evaluate(()=>({document:document.documentElement.scrollWidth>innerWidth,elements:[...document.querySelectorAll('input,button,select,.sample-fares,.sample-item,.panel')].filter(e=>e.getClientRects().length&&(e.getBoundingClientRect().left< -1||e.getBoundingClientRect().right>innerWidth+1||e.scrollWidth>e.clientWidth+2)).map(e=>e.id||e.className)}));
   assert.deepEqual(overflow,{document:false,elements:[]},'overflow at '+width);
   dimensions.push({width,dateWidths:dates.map(d=>d.width)});
   if(width===1280||width===320||width===390){await compact.evaluate(()=>window.scrollTo(0,0));await compact.screenshot({path:`verification/v122-${width}-compact-inputs.png`,fullPage:true})}
  }
  await compact.setViewportSize({width:390,height:844});await openManual(compact,true);
  for(const [start,end]of [['2028-02-05','2028-02-07'],['2028-02-12','2028-02-13']]){await compact.locator('#exclusion-start').fill(start);await compact.locator('#exclusion-end').fill(end);await compact.locator('#exclusion-reason').fill('test holiday');await compact.locator('#add-exclusion').click()}
  assert.equal(await compact.locator('[data-remove-exclusion]').count(),2);await compact.locator('[data-remove-exclusion]').first().click();assert.equal(await compact.locator('[data-remove-exclusion]').count(),1);
  await compact.locator('.calendar-day[data-date="2028-02-12"]').click();assert.equal(await compact.evaluate(()=>dateNodes.find(n=>n.date==='2028-02-12').enabled),true);
  assert.equal(await compact.locator('#generate-dates').textContent(),'日付条件を反映');assert.equal(await compact.locator('#refresh-from-exclusion').textContent(),'日付条件を反映');await compact.locator('#refresh-from-exclusion').click();assert.equal(await compact.evaluate(()=>dateNodes.find(n=>n.date==='2028-02-12').enabled),false);
  await compact.locator('#tab-samples').click();await compact.locator('[data-sample="01"]').click();await compact.evaluate(()=>window.scrollTo(0,0));await compact.screenshot({path:'verification/v122-390-compact-sample.png',fullPage:true});
  // Native print popup is exercised without changing or generating PDF binaries for this UI-only release.
  await loadSample(compact,'02');await compact.locator('#simulate-button').click();await reduced.addInitScript(()=>{window.print=()=>{}});
  const plans=await compact.evaluate(()=>buildPurchasePlans(lastResult));
  for(const id of ['BEST','RTT','CMT1M','CMT3M','CMT6M']){
   await compact.locator('#pdf-pattern').selectOption(id);const pending=compact.waitForEvent('popup');await compact.locator('#download-pdf').click();const popup=await pending;await popup.waitForLoadState('load');
   assert.equal(await popup.locator('.plan').count(),1);assert.equal(await popup.locator('.plan h2').textContent(),plans[id].label);
   const amounts=await popup.locator('tbody tr td:last-child').allTextContents();assert.equal(amounts.reduce((sum,s)=>sum+Number(s.replace(/[^0-9]/g,'')),0),plans[id].cost);
   if(id==='BEST')await popup.screenshot({path:'verification/v122-pdf-popup.png',fullPage:true});await popup.close();
  }
  const current=fs.readFileSync('script.js','utf8').replaceAll('\r\n','\n');const original=cp.execFileSync('git',['show','20f4987:'+path.basename(process.cwd())+'/script.js'],{encoding:'utf8'}).replaceAll('\r\n','\n');
  for(const [start,end]of [['function simulate() {','function getNextNodeIndex('],['function getPlanLabel(','function renderSummaryCard('],['function createSamples(','function initSamples('],['function applySample(','function restoreOriginalSettings('],['function restoreOriginalSettings(','function updateSampleStatus(']])assert.equal(current.slice(current.indexOf(start),current.indexOf(end,current.indexOf(start)+1)),original.slice(original.indexOf(start),original.indexOf(end,original.indexOf(start)+1)),start+' must be preserved');
  const targets=['index.html','script.js','style.css','.gitattributes','verification/test-beginner-ui.cjs','verification/test-experience.cjs','verification/test-compact-ui.cjs'];for(const file of targets)assert.ok(!fs.readFileSync(file).includes(13),file+' must use LF');
  fs.writeFileSync('verification/v122-layout-checks.json',JSON.stringify({before:baseline,after,dimensions,animation:during,lineEndings:'LF',preserved:'engine, samples, PDF generators, state restore'},null,2));
  assert.deepEqual(errors,[]);console.log('PASS v1.2.2: reversible 250ms animation, rapid switches, conditional scrolling, reduced motion, 4/2-column inputs, date pairs, long values, advanced settings, all 5 PDF popups, LF');console.log(JSON.stringify({before:baseline,after},null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
