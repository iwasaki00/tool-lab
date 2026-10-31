const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('url');
(async () => {
 const browser = await chromium.launch({channel:'chrome',headless:true});
 const context = await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
 const page = await context.newPage();
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 assert.equal(await page.locator('[data-sample]').count(),8);
 const results=[];
 for (const id of ['01','02','03','04','05','06','07','08']) {
   await page.locator(`[data-sample="${id}"]`).click();
   const actual=await page.evaluate(()=>({cost:lastResult.bestCost,method:getPurchaseMethod(lastResult),dates:lastResult.activeDates,flow:lastResult.flow,only:lastResult.patternOnlyCosts,sample:sampleSession.sample,html:document.getElementById('result-area').innerHTML}));
   // Execute the pre-change script in an isolated VM using the same input controls and exact active dates.
   const vm=require('vm');
   const values=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('input[id]')].map(e=>[e.id,{value:e.value,checked:e.checked}])));
   const original=require('child_process').execFileSync('git',['show','4aed15af365091b5b09637ea0bfd51e693c5d92e:01_乗車券購入シミュレータ/script.js'],{encoding:'utf8'});
   const currentScript=fs.readFileSync('script.js','utf8');
   const searchBody=text=>text.slice(text.indexOf('function simulate() {'),text.indexOf('function getNextNodeIndex('));
   assert.equal(searchBody(currentScript),searchBody(original),'route search changed');
   let baseline;
   const sandbox={console,Intl,Date,Map,localStorage:{setItem(){}},document:{addEventListener(){},getElementById(id){return values[id]},querySelectorAll(){return []}},capture:r=>baseline=r};
   vm.createContext(sandbox);
   vm.runInContext(original+`;dateNodes=${JSON.stringify(actual.dates.map(date=>({date,enabled:true})))};saveSettings=()=>{};renderResult=capture;scrollToResult=()=>{};simulate();`,sandbox);
   assert.equal(actual.cost,baseline.bestCost); assert.deepEqual(actual.flow,JSON.parse(JSON.stringify(baseline.flow)));
   assert.match(actual.html,new RegExp(String(actual.cost).replace(/\B(?=(\d{3})+(?!\d))/g,',')));
   assert.ok(!actual.html.includes('undefined'));
   const ui = await page.evaluate(()=>({weekdays:getSelectedWeekdays(),fares:Object.fromEntries(PATTERNS.map(p=>[p.fareId,Number(document.getElementById(p.fareId).value)])),exclusions:exclusionPeriods,nodes:dateNodes}));
   assert.deepEqual(ui.weekdays.sort(),actual.sample.weekdays.sort());
   assert.deepEqual(ui.fares,actual.sample.fares);
   assert.deepEqual(ui.exclusions,actual.sample.exclusions);
   if(id==='01') assert.ok(ui.nodes.filter(n=>n.enabled).every(n=>[1,2,3,4,5].includes(n.weekday)&&!n.holidayName));
   if(id==='02'||id==='06') assert.ok(ui.nodes.filter(n=>n.exclusionReason).every(n=>!n.enabled));
   if(id==='03') assert.ok(ui.nodes.filter(n=>n.enabled).every(n=>[1,3,5].includes(n.weekday)));
   if(id==='04') assert.ok(ui.nodes.filter(n=>n.enabled).every(n=>[2,4].includes(n.weekday)));
   if(id==='05') {
     const counts={}; for(const date of actual.dates) counts[date.slice(5,7)]=(counts[date.slice(5,7)]||0)+1;
     assert.ok(counts['10']<counts['08']/2 && counts['11']<counts['01']/2);
   }
   if(id==='06') assert.equal(ui.nodes.filter(n=>n.exclusionReason).length,30);
   if(id==='07') assert.ok(ui.nodes.some(n=>n.enabled&&[0,6].includes(n.weekday)));
   if(id==='08') assert.ok(ui.nodes.filter(n=>n.date>=actual.sample.start.slice(0,4)+'-11-01'&&n.enabled).every(n=>[2,4].includes(n.weekday)));
   const ordinaryWins=actual.flow.every(s=>s.patternId==='RTT')&&Object.entries(actual.only).filter(([id])=>id!=='RTT').every(([,cost])=>cost>actual.cost);
   assert.equal(actual.html.includes('定期券を買わない方が安い'),ordinaryWins);
   assert.equal(actual.dates.length,await page.locator('.calendar-day.is-active').count());
   results.push({id,cost:actual.cost,method:actual.method,days:actual.dates.length,start:actual.sample.start,end:actual.sample.end,only:actual.only,flow:actual.flow});
 }
 assert.ok(new Set(results.map(r=>[...new Set(r.flow.map(s=>s.patternId))].sort().join('+'))).size>=3);
 fs.writeFileSync('verification/sample-results.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results.map(({flow,...x})=>x),null,2));
 assert.deepEqual(errors,[]);
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
