const assert=require('node:assert/strict');
async function openManual(page,advanced=false){await page.locator('#tab-calculate').click();if(advanced)await page.locator('#advanced-settings').evaluate(e=>e.open=true)}
async function loadSample(page,id){await page.locator('#tab-samples').click();const card=page.locator('[data-sample="'+id+'"]');if(await card.getAttribute('aria-expanded')!=='true')await card.click();await page.locator('[data-apply-sample="'+id+'"]').click();assert.equal(await page.evaluate(()=>lastResult),null)}
module.exports={openManual,loadSample};
