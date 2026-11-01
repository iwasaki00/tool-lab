const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const {pathToFileURL}=require('url');
const {loadSample,openManual}=require('./ui-helpers.cjs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=pathToFileURL(path.resolve('index.html')).href;await page.goto(url);await openManual(page,true);
  await page.locator('#fare-one-way').fill('720');await page.locator('#fare-one-way').dispatchEvent('change');
  await page.locator('#start-date').fill('2027-03-01');await page.locator('#start-date').dispatchEvent('change');
  await page.locator('#end-date').fill('2027-05-31');await page.locator('#end-date').dispatchEvent('change');
  await page.locator('#exclusion-start').fill('2027-04-05');await page.locator('#exclusion-end').fill('2027-04-12');await page.locator('#exclusion-reason').fill('original vacation');await page.locator('#add-exclusion').click();
  await page.locator('.calendar-day[data-date="2027-03-06"]').click();await page.locator('#exclusion-reason').fill('unfinished draft');await page.locator('#simulate-button').click();
  const original=await page.evaluate(()=>captureInputState());
  await loadSample(page,'02');assert.deepEqual(await page.evaluate(()=>sampleSession.original),original);
  await loadSample(page,'04');assert.deepEqual(await page.evaluate(()=>sampleSession.original),original);
  assert.equal(await page.evaluate(()=>exclusionPeriods.length),0);assert.equal(await page.evaluate(()=>dateNodes.some(n=>n.exclusionReason)),false);
  assert.equal(await page.evaluate(()=>dateNodes.some(n=>n.enabled!==n.defaultEnabled)),false);assert.equal(await page.locator('#exclusion-reason').inputValue(),'');
  await page.locator('#fare-one-way').fill('700');await page.locator('#fare-one-way').dispatchEvent('change');assert.ok((await page.locator('#sample-status').textContent()).includes('変更済み'));
  await page.locator('#simulate-button').click();assert.ok((await page.locator('#discovery-title').textContent()).includes('変更後'));
  await page.reload();await openManual(page);assert.ok((await page.locator('#sample-status').textContent()).includes('変更済み'));
  await page.locator('#restore-settings').click();assert.deepEqual(await page.evaluate(()=>captureInputState()),original);
  assert.equal(await page.evaluate(()=>localStorage.getItem(SAMPLE_SESSION_KEY)),null);
  await loadSample(page,'07');const irregular=await page.evaluate(()=>dateNodes);await page.reload();await openManual(page);assert.deepEqual(await page.evaluate(()=>dateNodes),irregular);
  await page.locator('#restore-settings').click();assert.deepEqual(await page.evaluate(()=>captureInputState()),original);
  const summaries=[];
  for(const id of ['01','02','03','04','05','06','07','08']){
   await page.locator('#tab-samples').click();const card=page.locator('[data-sample="'+id+'"]');if(await card.getAttribute('aria-expanded')!=='true')await card.click();
   const preview=await page.locator('#sample-conditions-'+id).evaluate(e=>({period:[...e.querySelectorAll('.sample-period time')].map(t=>t.dateTime),fares:Object.fromEntries([...e.querySelectorAll('[data-preview-fare]')].map(d=>[d.dataset.previewFare,d.querySelector('dd').textContent])),weekdays:e.querySelector('[data-condition="weekdays"]').textContent,holiday:e.querySelector('[data-condition="holiday"]').textContent,leaves:[...e.querySelectorAll('.sample-leave li')].map(li=>({dates:[...li.querySelectorAll('time')].map(t=>t.dateTime),text:li.textContent})),overrides:[...e.querySelectorAll('.sample-date-overrides')].map(d=>({enabled:d.dataset.enabled,months:[...d.querySelectorAll('.exception-month')].map(m=>({month:m.dataset.month,text:m.querySelector('.exception-days').textContent}))})),inputs:e.querySelectorAll('input,select,textarea').length}));
   assert.equal(preview.inputs,0);
   const sample=await page.evaluate(id=>createSamples().find(s=>s.id===id),id);
   assert.deepEqual(preview.period,[sample.start,sample.end]);
   for(const [id,key]of [['RTT','fare-one-way'],['CMT1M','fare-cmt1m'],['CMT3M','fare-cmt3m'],['CMT6M','fare-cmt6m']])assert.equal(preview.fares[id],sample.fares[key].toLocaleString('ja-JP')+'円');
   const weekdayLabels=['日','月','火','水','木','金','土'];
   assert.equal(preview.weekdays,sample.weekdays.join(',')==='1,2,3,4,5'?'月〜金':sample.weekdays.length?sample.weekdays.map(d=>weekdayLabels[d]).join('・'):'個別日指定');
   assert.equal(preview.holiday,sample.excludeHoliday?'祝日除外':'祝日除外なし');
   assert.deepEqual(preview.leaves.map(p=>p.dates),sample.exclusions.map(p=>[p.start,p.end]));
   sample.exclusions.forEach((p,n)=>assert.ok(preview.leaves[n].text.includes(p.reason)));
   for(const enabled of [true,false]){
    const expected=Object.entries(sample.overrides).filter(([,v])=>v===enabled).map(([date])=>date).sort();
    const section=preview.overrides.find(s=>s.enabled===String(enabled));const actual=[];
    for(const group of section?.months||[])for(const range of group.text.split('・')){const [start,end]=range.split('〜').map(Number);for(let day=start;day<=(end??start);day++)actual.push(group.month+'-'+String(day).padStart(2,'0'))}
    assert.deepEqual(actual,expected);
   }
   await page.locator('[data-apply-sample="'+id+'"]').click();assert.equal(await page.evaluate(()=>lastResult),null);await page.locator('#simulate-button').click();
   const result=await page.evaluate(()=>lastResult);const plans=await page.evaluate(()=>buildPurchasePlans(lastResult));
   assert.equal(Object.keys(plans).length,5);
   for(const plan of Object.values(plans)){
    assert.equal(plan.cost,plan.id==='BEST'?result.bestCost:result.patternOnlyCosts[plan.id]);
    assert.deepEqual(plan.steps.flatMap(s=>s.dates),result.activeDates);
    assert.equal(plan.steps.reduce((sum,s)=>sum+s.cost,0),plan.cost);
    for(const step of plan.steps){assert.ok(step.dates.every(d=>d>=step.purchaseDate&&d<=step.validUntil));assert.equal(step.cost,result.context.fares[step.patternId==='RTT'?'fare-one-way':({CMT1M:'fare-cmt1m',CMT3M:'fare-cmt3m',CMT6M:'fare-cmt6m'})[step.patternId]]*(step.patternId==='RTT'?2:1))}
   }
   const stable=await page.evaluate(()=>{const model=createPdfModel(lastResult,'CMT3M');document.getElementById('fare-cmt3m').value='1';const unchanged=createPdfModel(lastResult,'CMT3M');document.getElementById('fare-cmt3m').value=lastResult.context.fares['fare-cmt3m'];return [model,unchanged]});assert.deepEqual(stable[0].plans,stable[1].plans);
   const tampered=await page.evaluate(()=>{const copy=structuredClone(lastResult);copy.patternOnlyCosts.CMT3M++;try{buildPurchasePlans(copy);return false}catch{return true}});assert.equal(tampered,true);
   summaries.push({id,bestCost:result.bestCost,plans:Object.values(plans).map(p=>({id:p.id,label:p.label,cost:p.cost,purchases:p.steps.length,ordinaryDays:p.steps.filter(s=>s.patternId==='RTT').length}))});
  }
  fs.writeFileSync('verification/v123-plan-checks.json',JSON.stringify(summaries,null,2));
  // Popup failure is recoverable beside the export controls.
  await page.evaluate(()=>{const saved=window.open;window.open=()=>null;downloadPdf();window.open=saved});assert.ok((await page.locator('#pdf-error').textContent()).includes('ポップアップ'));
  const exported=await page.evaluate(()=>{const saved=window.open;let html='';window.open=()=>({document:{open(){},write(t){html=t},close(){}}});document.getElementById('pdf-pattern').value='CMT3M';downloadPdf();window.open=saved;return html});assert.ok(exported.includes('3か月定期券のみ'));assert.ok(exported.includes('日本時間'));
  // Dates must be based on Tokyo regardless of the browser's timezone.
  const cases=[['2026-11-01T14:59:59Z','2026-11-02'],['2026-11-01T15:00:00Z','2026-11-03'],['2026-12-31T14:59:59Z','2027-01-01'],['2026-12-31T15:00:00Z','2027-01-02'],['2027-04-30T00:00:00Z','2027-05-01'],['2028-02-28T00:00:00Z','2028-02-29'],['2028-02-29T00:00:00Z','2028-03-01']];
  for(const timezoneId of ['UTC','Asia/Tokyo','America/Los_Angeles']){
   const c=await browser.newContext({timezoneId});const p=await c.newPage();await p.clock.install({time:new Date('2026-11-01T15:01:00Z')});await p.goto(url);
   for(const [instant,want]of cases){assert.equal(await p.evaluate(t=>getJapanTomorrow(new Date(t)),instant),want);const range=await p.evaluate(t=>{setDefaultDates(new Date(t));return [document.getElementById('start-date').value,document.getElementById('end-date').value]},instant);assert.equal(range[0],want);assert.ok(range[1]>=range[0])}
   await p.locator('#tab-calculate').click();await p.locator('#fare-one-way').fill('999');await p.locator('#fare-one-way').dispatchEvent('change');
   await Promise.all([p.waitForEvent('load'),p.locator('#reset-settings').click()]);await p.locator('#tab-calculate').click();
   assert.equal(await p.locator('#start-date').inputValue(),'2026-11-03');assert.equal(await p.locator('#end-date').inputValue(),'2027-05-02');assert.equal(await p.locator('#fare-one-way').inputValue(),'633');await c.close();
  }
  assert.deepEqual(errors,[]);console.log('PASS state/PDF: all 8 readonly previews, restore/reload/switches, 40 plan amounts/flows/coverage, frozen context, Japan-date boundaries in 3 timezones');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
