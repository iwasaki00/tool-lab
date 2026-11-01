const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');const cp=require('child_process');const {pathToFileURL}=require('url');const {loadSample}=require('./ui-helpers.cjs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-11-01T01:00:00Z')});const url=pathToFileURL(path.resolve('index.html')).href;await page.goto(url);await page.locator('#tab-calculate').tap();await page.locator('#advanced-settings').evaluate(e=>e.open=true);
  const toggle=page.locator('#calendar-toggle'),content=page.locator('#calendar-content');assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await content.evaluate(e=>e.getBoundingClientRect().height),0);assert.equal(await content.evaluate(e=>e.inert),true);
  const initial=await page.evaluate(()=>captureInputState());await toggle.tap();assert.equal(await toggle.getAttribute('aria-expanded'),'true');assert.deepEqual(await page.evaluate(()=>captureInputState()),initial);
  assert.ok(await content.evaluate(e=>e.getBoundingClientRect().height)>100);
  const holiday=await page.evaluate(()=>dateNodes.find(n=>n.holidayName)?.date);assert.ok(holiday);assert.ok((await page.locator('.calendar-day[data-date="'+holiday+'"]').textContent()).includes(await page.evaluate(d=>getHolidayName(d),holiday)));
  const first=await page.evaluate(()=>dateNodes[0].date);const was=await page.evaluate(d=>dateNodes.find(n=>n.date===d).enabled,first);await page.locator('.calendar-day[data-date="'+first+'"]').tap();
  const edited=await page.evaluate(()=>captureInputState());assert.equal(edited.dates.find(n=>n.date===first).enabled,!was);
  const wantedCount=edited.dates.filter(n=>n.enabled).length;assert.equal(await page.locator('#date-summary').textContent(),`有効日：${wantedCount}日 / 全${edited.dates.length}日`);
  await toggle.tap();assert.equal(await content.evaluate(e=>e.getBoundingClientRect().height),0);assert.deepEqual(await page.evaluate(()=>captureInputState()),edited);await toggle.tap();assert.deepEqual(await page.evaluate(()=>captureInputState()),edited);
  await toggle.focus();await page.keyboard.press('Enter');assert.equal(await toggle.getAttribute('aria-expanded'),'false');await page.keyboard.press('Space');assert.equal(await toggle.getAttribute('aria-expanded'),'true');await toggle.tap();
  // Only weeks containing in-range dates are rendered, including partial first/last months.
  for(const [start,end,monthCounts]of [['2027-08-27','2027-08-31',1],['2027-08-31','2027-09-01',2]]){
   await page.locator('#start-date').fill(start);await page.locator('#start-date').dispatchEvent('change');await page.locator('#end-date').fill(end);await page.locator('#end-date').dispatchEvent('change');await toggle.tap();
   assert.equal(await page.locator('#calendar-area .calendar-month').count(),monthCounts);
   const range=await page.evaluate(()=>({dates:dateNodes.map(n=>n.date),shown:[...document.querySelectorAll('#calendar-area [data-date]')].map(e=>e.dataset.date),blanks:[...document.querySelectorAll('#calendar-area .calendar-days')].map(e=>({count:e.querySelectorAll('.blank').length,first:e.querySelector('[data-date]').dataset.date}))}));assert.deepEqual(range.shown,range.dates);
   for(const month of range.blanks)assert.equal(month.count,new Date(month.first+'T12:00:00').getDay());await toggle.tap();
  }
  const saved=JSON.parse(fs.readFileSync('verification/v123-route-results.json','utf8')).results;const resultChecks=[];
  for(const expected of saved){
   await loadSample(page,expected.id);assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await page.evaluate(()=>lastResult),null);
   const input=await page.evaluate(()=>({days:dateNodes.filter(n=>n.enabled).length,total:dateNodes.length}));assert.equal(input.days,expected.days);assert.equal(await page.locator('#date-summary').textContent(),`有効日：${input.days}日 / 全${input.total}日`);
   await page.locator('#simulate-button').tap();const actual=await page.evaluate(()=>({cost:lastResult.bestCost,only:lastResult.patternOnlyCosts,plans:lastResult.purchasePlans,simulatedAt:lastResult.simulatedAt,flow:lastResult.flow}));assert.equal(actual.cost,expected.cost);assert.deepEqual(actual.only,expected.only);assert.deepEqual(actual.plans,expected.plans);
   assert.equal(await page.locator('#pdf-pattern option').count(),5);assert.equal(await page.locator('#download-all-pdf').isEnabled(),true);
   const screenCosts=await page.locator('.summary-grid .summary-value').allTextContents();for(const plan of Object.values(actual.plans))assert.ok(screenCosts.includes(plan.cost.toLocaleString('ja-JP')+'円'));
   // Export remains possible with all route/date/price calculation helpers disabled after calculation.
   const frozen=await page.evaluate(()=>{
    const saved={createPurchasePlans,getNextNodeIndex,createFlowStep,addMonthsSafe,snapshotPatternCost,getPatternCost};const fail=()=>{throw Error('Export tried to recalculate')};
    createPurchasePlans=getNextNodeIndex=createFlowStep=addMonthsSafe=snapshotPatternCost=getPatternCost=fail;
    try{const model=createPdfModel(lastResult,'ALL',new Date('2026-11-03T02:00:00Z'));return {model,html:renderPdfHtml(model)}}finally{({createPurchasePlans,getNextNodeIndex,createFlowStep,addMonthsSafe,snapshotPatternCost,getPatternCost}=saved)}
   });assert.deepEqual(frozen.model.plans,Object.values(actual.plans));assert.ok(frozen.model.simulatedAt.startsWith('2026/11/01'));assert.ok(frozen.model.createdAt.startsWith('2026/11/03'));assert.ok(frozen.html.includes('全購入パターンの比較一覧'));
   for(const plan of frozen.model.plans){assert.ok(frozen.html.includes(plan.cost.toLocaleString('ja-JP')+'円'));for(const step of plan.steps.filter(s=>s.patternId!=='RTT')){assert.ok(frozen.html.includes(step.purchaseDate.replaceAll('-','/')));assert.ok(frozen.html.includes(step.validUntil.replaceAll('-','/')))}}
   const stable=await page.evaluate(()=>{const model=createPdfModel(lastResult);model.plans[0].steps[0].cost++;return buildPurchasePlans(lastResult).BEST.cost===lastResult.bestCost});assert.equal(stable,true);
   resultChecks.push({id:expected.id,cost:actual.cost,unchangedPlans:true,exportUsesSnapshot:true});
  }
  // Measure from the same sample/calendar heading as the before capture.
  await loadSample(page,'01');await page.locator('#advanced-settings').evaluate(e=>e.open=true);
  await page.evaluate(()=>{const heading=document.getElementById('calendar-title');const top=heading.getBoundingClientRect().top+scrollY-document.querySelector('.app-header').getBoundingClientRect().bottom-12;scrollTo(0,top)});
  const after=await page.evaluate(()=>{const h=document.getElementById('calendar-title').getBoundingClientRect(),b=document.getElementById('simulate-button').getBoundingClientRect();return {width:innerWidth,viewportHeight:innerHeight,calendarHeight:document.getElementById('calendar-content').getBoundingClientRect().height,calendarPanelHeight:document.querySelector('.calendar-panel').getBoundingClientRect().height,headingToButton:b.top-h.top,additionalScroll:Math.max(0,b.bottom-innerHeight+16),months:document.querySelectorAll('#calendar-area .calendar-month').length}});
  const before=JSON.parse(fs.readFileSync('verification/v124-before.json','utf8'));assert.equal(after.calendarHeight,0);assert.equal(after.additionalScroll,0);assert.ok(before.headingToButton-after.headingToButton>2000);await page.screenshot({path:'verification/v124-390-after-calendar.png'});
  await toggle.tap();await page.screenshot({path:'verification/v124-390-calendar-open.png'});await toggle.tap();
  // Validate summary/data and actual new popup script in selected and all-pattern actions.
  await page.locator('#simulate-button').tap();assert.equal(await page.locator('#pdf-title').textContent(),'シミュレーション結果をPDF保存');assert.equal(await page.locator('#download-pdf').textContent(),'選択した購入パターンをPDF保存');assert.equal(await page.locator('#download-all-pdf').textContent(),'全購入パターンをまとめてPDF保存');
  await context.addInitScript(()=>{window.print=()=>{window.printWasCalled=true}});
  const outputs=[];fs.mkdirSync('tmp/pdfs/v124-generated',{recursive:true});
  for(const selection of ['CMT3M','ALL']){
   if(selection!=='ALL')await page.locator('#pdf-pattern').selectOption(selection);
   const pending=page.waitForEvent('popup');await page.locator(selection==='ALL'?'#download-all-pdf':'#download-pdf').tap();const popup=await pending;popup.on('pageerror',e=>errors.push(e.message));await popup.waitForLoadState('load');await popup.waitForFunction(()=>window.printWasCalled===true);
   const model=await page.evaluate(id=>createPdfModel(lastResult,id),selection);assert.equal(await popup.locator('.plan').count(),model.plans.length);assert.equal(await popup.locator('.comparison-overview').count(),selection==='ALL'?1:0);
   if(selection==='ALL'){assert.deepEqual(await popup.locator('[data-comparison]').evaluateAll(es=>es.map(e=>e.dataset.comparison)),model.plans.map(p=>p.id));const rows=await popup.locator('[data-comparison]').allTextContents();for(let n=0;n<rows.length;n++)assert.ok(rows[n].includes(model.plans[n].cost.toLocaleString('ja-JP')+'円'))}
   const documentText=await popup.locator('body').textContent();for(const label of ['シミュレーション日時','出力日時','普通乗車券：','購入スケジュール','最安方法との差額'])assert.ok(documentText.includes(label));
   const filename='ux_'+selection+'.pdf';await popup.pdf({path:'tmp/pdfs/v124-generated/'+filename,format:'A4',preferCSSPageSize:true,printBackground:true});outputs.push({filename,selection,plans:model.plans.map(p=>({id:p.id,label:p.label,cost:p.cost,steps:p.steps.length})),simulatedAt:model.simulatedAt});await popup.close();
  }
  // Disabled references can be cheaper than the selected search; show signed differences and reference labels.
  await page.evaluate(()=>{document.getElementById('use-cmt1m').checked=false;document.getElementById('use-cmt3m').checked=false;document.getElementById('use-cmt6m').checked=false;invalidateSimulation();executeSimulation()});
  const reference=await page.evaluate(()=>renderPdfHtml(createPdfModel(lastResult,'ALL')));assert.ok(reference.includes('参考額（最安探索の対象外）'));assert.ok(reference.includes('−'));assert.ok(reference.includes('同額'));assert.ok(!reference.includes('+0円'));
  // Changes disable both buttons; failed popup keeps a useful inline error.
  await page.evaluate(()=>{const original=window.open;window.open=()=>null;downloadPdf('ALL');window.open=original});assert.ok((await page.locator('#pdf-error').textContent()).includes('ポップアップ'));
  await page.locator('#fare-one-way').fill('600');await page.locator('#fare-one-way').dispatchEvent('change');assert.equal(await page.locator('#download-all-pdf').isDisabled(),true);assert.equal(await page.locator('#download-pdf').isDisabled(),true);
  const layouts=[];
  for(const width of [320,375,390,740,768,1280]){
   await page.setViewportSize({width,height:900});await loadSample(page,'02');await page.locator('#advanced-settings').evaluate(e=>e.open=true);
   for(const expanded of [false,true]){await page.evaluate(e=>setCalendarExpanded(e),expanded);const overflow=await page.evaluate(()=>[...document.querySelectorAll('button,input,select,.calendar-panel,.calendar-collapse,.calendar-month,.pdf-actions')].filter(e=>e.getClientRects().length&&(e.getBoundingClientRect().right>innerWidth+1||e.getBoundingClientRect().left< -1||e.scrollWidth>e.clientWidth+2)).map(e=>e.id||e.className));assert.deepEqual(overflow,[],width+' expanded='+expanded);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
   await page.evaluate(()=>setCalendarExpanded(false));await page.locator('#simulate-button').tap();const buttons=await page.locator('.pdf-buttons button').evaluateAll(es=>es.map(e=>({top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom,height:e.getBoundingClientRect().height})));assert.ok(buttons[1].top>=buttons[0].bottom+8);assert.ok(buttons.every(e=>e.height>=48));
   const pdfOverflow=await page.locator('.pdf-actions').evaluate(e=>e.scrollWidth>e.clientWidth+2);assert.equal(pdfOverflow,false);
   if(width===390||width===1280)await page.screenshot({path:'verification/v124-'+width+'-pdf-actions.png'});layouts.push({width,calendarFits:true,pdfButtonsStacked:true});
  }
  // Smooth animation, rapid reversals and reduced motion do not alter data.
  const animationPage=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'no-preference'});await animationPage.goto(url);await animationPage.locator('#tab-calculate').click();await animationPage.locator('#advanced-settings').evaluate(e=>e.open=true);const animInitial=await animationPage.evaluate(()=>captureInputState());
  await animationPage.evaluate(()=>setCalendarExpanded(true));await animationPage.waitForTimeout(65);const during=await animationPage.locator('#calendar-content').evaluate(e=>({height:e.getBoundingClientRect().height,opacity:Number(getComputedStyle(e).opacity),duration:getComputedStyle(e).transitionDuration}));await animationPage.waitForTimeout(250);const full=await animationPage.locator('#calendar-content').evaluate(e=>e.getBoundingClientRect().height);assert.ok(during.height>0&&during.height<full);assert.ok(during.opacity>0&&during.opacity<1);assert.ok(during.duration.includes('0.22s'));
  await animationPage.evaluate(async()=>{for(let i=0;i<6;i++){setCalendarExpanded(i%2!==0);await new Promise(r=>setTimeout(r,25))}setCalendarExpanded(false)});await animationPage.waitForTimeout(260);assert.equal(await animationPage.locator('#calendar-content').evaluate(e=>e.getBoundingClientRect().height),0);assert.deepEqual(await animationPage.evaluate(()=>captureInputState()),animInitial);await animationPage.close();
  // Core engine and sample fares/schedules remain byte-for-byte unchanged from v1.2.3.
  const current=fs.readFileSync('script.js','utf8');const original=cp.execFileSync('git',['show','ace8409:'+path.basename(process.cwd())+'/script.js'],{encoding:'utf8'}).replaceAll('\r\n','\n');for(const [start,end]of [['function simulate()','function renderResult('],['function createSamples(','function initSamples(']])assert.equal(current.slice(current.indexOf(start),current.indexOf(end)),original.slice(original.indexOf(start),original.indexOf(end)));
  assert.deepEqual(errors,[]);fs.writeFileSync('verification/v124-calendar-pdf-checks.json',JSON.stringify({before,after,resultChecks,outputs,layouts,animation:during,javascriptErrors:errors},null,2)+'\n');console.log('PASS v1.2.4: collapsed calendar, edits/count retention, in-range weeks, keyboard/touch, 8 unchanged results/40 cached plans, no export recomputation, selected/ALL print, 6 widths, 220ms animation');console.log(JSON.stringify({before,after},null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
