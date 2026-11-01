const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const {pathToFileURL}=require('url');
const {loadSample}=require('./ui-helpers.cjs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  await page.clock.install({time:new Date('2026-11-01T01:00:00Z')});
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  fs.mkdirSync('tmp/pdfs/generated',{recursive:true});const checks=[];
  async function exportPlan(sample,id,extendedEnd=null){
   await loadSample(page,sample);if(extendedEnd){await page.locator('#end-date').fill(extendedEnd);await page.locator('#end-date').dispatchEvent('change')}await page.locator('#simulate-button').click();await page.locator('#pdf-pattern').selectOption(id);
   await page.context().addInitScript(()=>{window.print=()=>{}});
   const popupEvent=page.waitForEvent('popup');await page.locator('#download-pdf').click();const popup=await popupEvent;
   await popup.waitForLoadState('load');await popup.evaluate(()=>document.fonts.ready);
   const model=await page.evaluate(id=>createPdfModel(lastResult,id),id);
   assert.equal(await popup.title(),model.filename);
   assert.ok((await popup.locator('h1').textContent()).includes('乗車券購入シミュレーション'));
   assert.equal(await popup.locator('.plan').count(),id==='ALL'?5:1);
   for(let n=0;n<model.plans.length;n++){
    const plan=model.plans[n];const rows=popup.locator('.plan').nth(n).locator('tbody tr');
    const amounts=await rows.locator('td:last-child').allTextContents();
    assert.equal(amounts.reduce((s,text)=>s+Number(text.replace(/[^0-9]/g,'')),0),plan.cost);
   }
   const overflow=await popup.evaluate(()=>[...document.querySelectorAll('table,td,th')].filter(e=>e.scrollWidth>e.clientWidth+2).length);assert.equal(overflow,0);
   const filename=`sample${sample}_${id}.pdf`;await popup.pdf({path:'tmp/pdfs/generated/'+filename,format:'A4',preferCSSPageSize:true,printBackground:true});
   checks.push({filename,sample,selection:id,title:model.filename,plans:model.plans.map(p=>({label:p.label,cost:p.cost,steps:p.steps.length})),condition:model.context});await popup.close();
  }
  for(const id of ['BEST','RTT','CMT1M','CMT3M','CMT6M'])await exportPlan('02',id);
  await exportPlan('06','ALL','2030-01-31');await exportPlan('07','RTT');
  fs.writeFileSync('verification/v121-pdf-checks.json',JSON.stringify(checks,null,2));
  console.log('PASS PDF: 7 real Chrome PDFs, all 5 pattern names/totals, per-pattern rows, filenames, no table overflow');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
