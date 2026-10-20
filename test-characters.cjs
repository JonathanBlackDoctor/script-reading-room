const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const Core=require('./dist/state.js');
const BASE=process.env.READER_TEST_URL||'http://127.0.0.1:18871/';
const luminance=rgb=>{const v=rgb.match(/[\d.]+/g).slice(0,3).map(x=>{x=Number(x)/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});return .2126*v[0]+.7152*v[1]+.0722*v[2]};
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(BASE+'#sidong/1');await page.waitForSelector('.speaker .character-name');
  assert.equal(await page.locator('.character-name:not(.speaker .character-name)').count(),0);
  const exact=await page.evaluate(()=>({summary:[...document.querySelectorAll('.overview-text>p')].map(p=>p.textContent),expected:READING_BOOKS[0].scenes[0].summary,original:[...document.querySelectorAll('#original-text p')].map(p=>p.textContent),lines:READING_BOOKS[0].scenes[0].lines.map(l=>l.text)}));
  assert.deepEqual(exact.summary,exact.expected);assert.deepEqual(exact.original,exact.lines);
  const full=await page.locator('.speaker .character-name[data-character="임공우"]').first().evaluate(e=>getComputedStyle(e).color);
  const colors=await page.locator('.speaker .character-name').evaluateAll(ns=>ns.map(e=>({color:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor,shadow:getComputedStyle(e).boxShadow})));
  for(const item of colors){assert.equal(item.bg,'rgba(0, 0, 0, 0)');assert.equal(item.shadow,'none');assert.ok(luminance(item.color)<.2);assert.ok(1.05/(luminance(item.color)+.05)>=4.5)}
  assert.equal(new Set(await page.locator('.speaker .character-name[data-character="임공우"]').evaluateAll(ns=>ns.map(e=>getComputedStyle(e).color))).size,1);
  await page.getByRole('button',{name:'읽기 설정 열기',exact:true}).click();await page.getByLabel('말하는 사람 이름 색상',{exact:true}).uncheck();
  await page.getByRole('button',{name:'이 설정으로 읽기',exact:true}).click();
  assert.equal(await page.locator('.speaker .character-name').first().evaluate(e=>getComputedStyle(e).color===getComputedStyle(e.parentElement).color),true);
  await page.reload();await page.waitForSelector('#original-text');assert.equal(await page.locator('body.character-colors').count(),0);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('between-acts:v1:')))));
  assert.equal(Core.normalize(saved,await page.evaluate(()=>READING_BOOKS),true).settings.characterColors,false);
  await page.getByRole('button',{name:'읽기 설정 열기',exact:true}).click();await page.getByLabel('말하는 사람 이름 색상',{exact:true}).check();await page.getByRole('button',{name:'밤 테마 사용',exact:true}).click();await page.getByRole('button',{name:'이 설정으로 읽기',exact:true}).click();
  assert.notEqual(await page.locator('.speaker .character-name').first().evaluate(e=>getComputedStyle(e).color),full);
  await page.goto(BASE+'#temp/1');await page.waitForSelector('#original-text');assert.ok(await page.locator('.speaker .character-name[data-character="오한구"]').count());assert.ok(await page.locator('.speaker .character-name[data-character="신반장"]').count());
  assert.equal(await page.locator('.character-name:not(.speaker .character-name)').count(),0);
  await page.goto(BASE+'#temp/5');await page.waitForSelector('#original-text');assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#original-text p')].every((p,i)=>p.textContent===READING_BOOKS[1].scenes[4].lines[i].text)),true);
  await page.getByRole('button',{name:'읽기 설정 열기',exact:true}).click();await page.getByRole('button',{name:'종이 테마로 바꾸기',exact:true}).click();await page.getByRole('button',{name:'이 설정으로 읽기',exact:true}).click();
  await page.goto(BASE+'#sidong/1');await page.waitForSelector('#original-text');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'.preview/continuous-summary-phone.png'});
  await page.locator('.speaker .character-name').first().evaluate(e=>{e.scrollIntoView();scrollBy(0,-140)});await page.screenshot({path:'.preview/speaker-color-phone.png'});
  assert.deepEqual(errors,[]);console.log('PASS only speaker labels colored, dark foreground and no highlight, exact summary/source text, consistent identities, toggle/reload/backup, both scripts and night theme');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
