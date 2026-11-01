const {chromium}=require('playwright');
const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');const {pathToFileURL}=require('url');
const {loadSample}=require('./ui-helpers.cjs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const external=[];page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url())});
  await page.clock.install({time:new Date('2026-11-01T01:00:00Z')});const url=pathToFileURL(path.resolve('index.html')).href;await page.goto(url);
  const baseline=JSON.parse(fs.readFileSync('verification/v123-initial-comparison.json','utf8'));const results=[];
  const fareKeys=['fare-one-way','fare-cmt1m','fare-cmt3m','fare-cmt6m'];
  for(const id of ['01','02','03','04','05','06','07','08']){
   await page.locator('#tab-samples').click();assert.ok((await page.locator('.sample-route-banner').textContent()).includes('共通区間：横浜 ⇔ 東京'));
   const card=page.locator('[data-sample="'+id+'"]');if(await card.getAttribute('aria-expanded')!=='true')await card.click();
   const region=page.locator('#sample-conditions-'+id);assert.ok((await region.locator('[data-sample-route]').textContent()).includes('横浜 ⇔ 東京（JR東海道線）'));
   const type=id==='02'?'通学（大学）':'通勤';assert.equal(await region.locator('[data-sample-pass]').textContent(),'定期券種別：'+type);
   if(id==='02'){assert.ok((await card.textContent()).includes('02 長期休暇のある大学生'));assert.ok((await region.locator('.sample-student-notice').textContent()).includes('学校が証明した通学区間'))}
   else assert.equal(await region.locator('.sample-student-notice').count(),0);
   await page.locator('[data-apply-sample="'+id+'"]').click();assert.equal(await page.evaluate(()=>lastResult),null);assert.equal(await page.evaluate(()=>activeSection),'calculate');
   const fares=await page.evaluate(keys=>keys.map(k=>Number(document.getElementById(k).value)),fareKeys);assert.deepEqual(fares,id==='02'?[528,8550,24350,46160]:[528,15600,44460,79650]);
   const sample=await page.evaluate(()=>sampleSession.sample);const old=baseline.before.find(r=>r.id===id);
   for(const key of ['start','end','weekdays','excludeHoliday','excludeWeekend','overrides','exclusions'])assert.deepEqual(sample[key],old.sample[key],id+' schedule '+key);
   await page.locator('#simulate-button').click();
   const record=await page.evaluate(()=>({id:sampleSession.sample.id,name:sampleSession.sample.name,cost:lastResult.bestCost,method:getPurchaseMethod(lastResult),days:lastResult.activeDates.length,only:lastResult.patternOnlyCosts,signature:[...new Set(lastResult.flow.map(s=>s.patternId))].sort().join('+'),context:lastResult.context,plans:buildPurchasePlans(lastResult)}));
   const initial=baseline.initial.find(r=>r.id===id);for(const key of ['cost','method','days','only','signature'])assert.deepEqual(record[key],initial[key],id+' initial recalculation '+key);
   assert.equal(record.only.RTT,record.days*1056);assert.equal(record.context.journey.passType,type);
   assert.ok((await page.locator('.discovery').textContent()).includes(record.cost.toLocaleString('ja-JP')+'円'));
   assert.equal(await page.locator('.discovery [data-sample-pass]').textContent(),'定期券種別：'+type);
   const pdfs=await page.evaluate(()=>Object.keys(buildPurchasePlans(lastResult)).map(id=>{const model=createPdfModel(lastResult,id);return {model,html:renderPdfHtml(model)}}));
   for(const {model,html}of pdfs){
    assert.deepEqual(model.context.journey,record.context.journey);assert.ok(html.includes('横浜 ⇔ 東京'));assert.ok(html.includes('JR東海道線'));assert.ok(html.includes('定期券種別：'+type));assert.ok(html.includes('528円'));
    const plan=model.plans[0];assert.equal(plan.steps.reduce((sum,s)=>sum+s.cost,0),plan.cost);
    assert.ok(html.includes(plan.cost.toLocaleString('ja-JP')+'円'));
    for(const step of plan.steps){assert.ok(step.dates.every(d=>d>=step.purchaseDate&&d<=step.validUntil));assert.equal(step.purchaseDate,step.dates[0]);}
   }
   results.push(record);
  }
  assert.equal(new Set(results.map(r=>r.signature)).size,5);
  const studentComparison=await page.evaluate(()=>{const sample=createSamples().find(s=>s.id==='02');sample.exclusions=[];applySample(sample);executeSimulation();return {withoutVacations:{cost:lastResult.bestCost,method:getPurchaseMethod(lastResult),days:lastResult.activeDates.length}}});
  assert.equal(studentComparison.withoutVacations.cost,46160);assert.equal(studentComparison.withoutVacations.method,'6ヶ月定期券 × 1枚');
  studentComparison.withVacations={cost:results[1].cost,method:results[1].method,days:results[1].days};
  // The sample journey is frozen with the result; edited conditions must be identified clearly.
  await loadSample(page,'02');await page.locator('#fare-one-way').fill('600');await page.locator('#fare-one-way').dispatchEvent('change');await page.locator('#simulate-button').click();
  assert.ok((await page.locator('.discovery').textContent()).includes('入力金額を使用'));const modified=await page.evaluate(()=>createPdfModel(lastResult,'ALL'));assert.equal(modified.context.modified,true);assert.equal(modified.context.fares['fare-one-way'],600);
  // Old stored sessions are preserved and must not acquire a false claim that old fares are this route's master.
  await page.evaluate(()=>{delete sampleSession.sample.journey;sampleSession.sample.fares={'fare-one-way':633,'fare-cmt1m':22980,'fare-cmt3m':65500,'fare-cmt6m':124100};for(const [id,fare]of Object.entries(sampleSession.sample.fares))document.getElementById(id).value=fare;saveSettings();persistSampleSession()});
  await page.reload();await page.locator('#tab-calculate').click();assert.deepEqual(await page.evaluate(keys=>keys.map(k=>Number(document.getElementById(k).value)),fareKeys),[633,22980,65500,124100]);assert.equal(await page.locator('#sample-route-context [data-sample-route]').count(),0);
  await page.locator('#simulate-button').click();assert.equal(await page.evaluate(()=>lastResult.context.journey),null);await page.locator('#restore-settings').click();
  // Existing custom manual values survive reload and merely opening the updated sample tab.
  await page.locator('#fare-one-way').fill('987');await page.locator('#fare-one-way').dispatchEvent('change');const custom=await page.evaluate(()=>captureInputState());
  await page.reload();assert.deepEqual(await page.evaluate(()=>captureInputState()),custom);await page.locator('#tab-samples').click();assert.deepEqual(await page.evaluate(()=>captureInputState()),custom);
  const layouts=[];
  for(const width of [1280,740,390,375,320]){
   await page.setViewportSize({width,height:900});
   for(const id of ['01','02','03','04','05','06','07','08']){
    await page.locator('#tab-samples').click();const card=page.locator('[data-sample="'+id+'"]');if(await card.getAttribute('aria-expanded')!=='true')await card.click();
    const overflow=await page.evaluate(()=>({document:document.documentElement.scrollWidth>innerWidth,items:[...document.querySelectorAll('.sample-item,.sample-route-banner,.sample-route-info,.sample-student-notice,[data-sample-pass],[data-sample-route]')].filter(e=>e.getClientRects().length&&(e.getBoundingClientRect().right>innerWidth+1||e.getBoundingClientRect().left< -1||e.scrollWidth>e.clientWidth+2)).map(e=>e.id||e.className)}));assert.deepEqual(overflow,{document:false,items:[]},width+' sample '+id);
   }
   if(width===1280||width===390||width===320){const card=page.locator('[data-sample="02"]');await card.click();await page.screenshot({path:'verification/v123-'+width+'-student-preview.png',fullPage:true});await page.locator('[data-apply-sample="02"]').click();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'verification/v123-'+width+'-student-loaded.png',fullPage:true});await page.locator('#simulate-button').click();await page.evaluate(()=>document.querySelector('.result-panel').scrollIntoView());await page.screenshot({path:'verification/v123-'+width+'-student-result.png'});}
   layouts.push({width,all8PreviewsFit:true});
  }
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  fs.writeFileSync('verification/v123-route-results.json',JSON.stringify({results,studentComparison,layouts,externalRequests:external},null,2)+'\n');
  console.log('PASS v1.2.3: 8 real-route samples, both fare masters, 1056/day, unchanged schedules, 5 methods, all 40 PDF models, legacy/manual preservation, 5 widths, no external requests');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
