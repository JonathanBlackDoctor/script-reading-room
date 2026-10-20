const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const Core=require('./dist/state.js');
const BASE=process.env.READER_TEST_URL||'http://127.0.0.1:18871/';
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(BASE+'#sidong/1');await page.waitForSelector('.summary-card .character-name');
  assert.ok(await page.locator('body.character-colors').count());
  const summary=await page.evaluate(()=>{
   const b=READING_BOOKS[0];return {actual:[...document.querySelectorAll('.summary-card>p')].map(x=>x.textContent),expected:b.scenes[0].summary};
  });assert.deepEqual(summary.actual,summary.expected);
  const short=await page.locator('.summary-card .character-name[data-character="임공우"]').first().evaluate(e=>getComputedStyle(e).color);
  await page.locator('.recap-box>summary').click();await page.locator('.cast-recap>summary').click();
  const full=await page.locator('.cast-list dt .character-name[data-character="임공우"]').evaluate(e=>getComputedStyle(e).color);assert.equal(short,full);
  await page.locator('.recap-box>summary').click();
  await page.getByRole('tab',{name:'원문',exact:true}).click();await page.waitForSelector('#original-text');
  assert.equal(await page.locator('.speaker .character-name[data-character="임공우"]').first().evaluate(e=>getComputedStyle(e).color),short);
  assert.equal(await page.evaluate(()=>{
   const b=READING_BOOKS[0],lines=b.scenes[0].lines;
   return [...document.querySelectorAll('#original-text p')].every((p,i)=>p.textContent===(lines[i].speaker?lines[i].speaker+lines[i].body:lines[i].text));
  }),true);
  await page.getByRole('button',{name:'읽기 설정 열기',exact:true}).click();
  await page.getByLabel('등장인물 이름 색상',{exact:true}).uncheck();
  assert.equal(await page.locator('body.character-colors').count(),0);
  await page.locator('#font-slider').press('Home');await page.getByRole('button',{name:'이 설정으로 읽기',exact:true}).click();
  await page.reload();await page.waitForSelector('#original-text');assert.equal(await page.locator('body.character-colors').count(),0);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('between-acts:v1:')))));
  assert.equal(Core.normalize(saved,await page.evaluate(()=>READING_BOOKS),true).settings.characterColors,false);
  delete saved.settings.characterColors;assert.equal(Core.normalize(saved,await page.evaluate(()=>READING_BOOKS),true).settings.characterColors,true);
  await page.getByRole('button',{name:'읽기 설정 열기',exact:true}).click();await page.getByLabel('등장인물 이름 색상',{exact:true}).check();
  await page.getByRole('button',{name:'밤 테마 사용',exact:true}).click();await page.getByRole('button',{name:'이 설정으로 읽기',exact:true}).click();
  assert.notEqual(await page.locator('.speaker .character-name').first().evaluate(e=>getComputedStyle(e).color),short);
  await page.goto(BASE+'#temp/1');await page.waitForSelector('#original-text');
  assert.ok(await page.locator('.character-name[data-character="오한구"]').count());assert.ok(await page.locator('.character-name[data-character="신반장"]').count());
  await page.setViewportSize({width:320,height:740});await page.getByRole('button',{name:'읽기 설정 열기',exact:true}).click();await page.locator('#font-slider').press('End');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('#settings-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  await page.getByRole('button',{name:'종이 테마로 바꾸기',exact:true}).click();await page.getByRole('button',{name:'이 설정으로 읽기',exact:true}).click();
  await page.goto(BASE+'#sidong/1');await page.waitForSelector('#original-text');await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:'.preview/character-colors-phone.png'});
  assert.deepEqual(errors,[]);console.log('PASS character identity colors, untouched text, toggle, reload/backup compatibility, both scripts, night theme and 320px settings');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
