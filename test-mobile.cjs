const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs/promises');
const BASE=process.env.READER_TEST_URL||'http://127.0.0.1:18871/';
const OUT=path.join(__dirname,'.preview');
(async()=>{
 await fs.mkdir(OUT,{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const settle=()=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r)))));
 const state=()=>p.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('between-acts:v1:')&&!k.endsWith(':before-import')))));
 const noOverflow=async label=>assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label);
 const pass=t=>console.log('PASS',t);
 try{
  await p.goto(BASE+'#sidong/1');await p.waitForSelector('#original-text');await settle();
  assert.ok((await p.locator('.topbar').boundingBox()).height<=64);for(const id of ['toc-toggle','settings-open','context-open'])assert.ok((await p.locator('#'+id).boundingBox()).height>=44);
  assert.equal(await p.getByRole('tab').count(),0);assert.equal(await p.locator('.overview-text').isVisible(),true);assert.equal(await p.locator('#mobile-reading-nav').isVisible(),true);pass('clear touch controls, compact summary and continuous original');
  await p.screenshot({path:path.join(OUT,'phone-summary-390.png')});
  await p.getByRole('button',{name:'모바일 다음 장면',exact:true}).click();await p.waitForURL('**/#sidong/2');await settle();assert.equal((await state()).books.sidong.scenes[1].summaryDone,false);
  await p.getByRole('checkbox',{name:'이 장면 요약 읽음',exact:true}).check();assert.equal((await state()).books.sidong.scenes[2].summaryDone,true);
  await p.getByRole('button',{name:'모바일 이전 장면',exact:true}).click();await p.waitForURL('**/#sidong/1');await settle();pass('next is navigation only and read status has its own checkbox');
  await p.getByRole('button',{name:'읽기 설정 열기',exact:true}).click();await p.locator('#font-slider').press('Home');await settle();assert.equal(await p.locator('#settings-font-size').textContent(),'12px');await p.getByRole('button',{name:'이 설정으로 읽기',exact:true}).click();await settle();
  assert.equal(await p.locator('#original-text').evaluate(e=>getComputedStyle(e).fontSize),'12px');await p.reload();await p.waitForSelector('#original-text');assert.equal((await state()).settings.fontSize,12);pass('phone supports persistent 12px body text');
  await p.getByRole('button',{name:'읽기 설정 열기',exact:true}).click();await p.locator('#font-slider').press('End');await p.screenshot({path:path.join(OUT,'phone-settings-390.png')});await p.getByRole('button',{name:'이 설정으로 읽기',exact:true}).click();await settle();
  for(const [width,height]of [[320,740],[360,800],[375,812],[390,844],[414,896],[430,932],[740,360]]){await p.setViewportSize({width,height});await settle();await noOverflow(`summary32:${width}`);const box=await p.locator('.toolbar').boundingBox();assert.ok(box.x+box.width<=width+1);}
  pass('large type and the labelled header fit seven phone layouts');
  await p.setViewportSize({width:390,height:844});await p.locator('.scene-overview>summary').click();await settle();assert.equal(await p.locator('.overview-text').isVisible(),false);assert.equal(await p.locator('#original-text').isVisible(),true);
  for(const width of [320,360,390,430]){await p.setViewportSize({width,height:844});await settle();await noOverflow(`original32:${width}`);}pass('original panel fits narrow screens with maximum font size');
  await p.setViewportSize({width:390,height:844});await settle();await p.getByRole('button',{name:'읽기 설정 열기',exact:true}).click();await p.locator('#font-slider').press('Home');for(let i=0;i<6;i++)await p.locator('#font-slider').press('ArrowRight');await p.getByRole('button',{name:'이 설정으로 읽기',exact:true}).click();await settle();
  await p.locator('#line-100').evaluate(e=>{e.scrollIntoView();scrollBy(0,-105);});await settle();await p.getByRole('button',{name:'현재 원문 문단에 책갈피 남기기',exact:true}).click();assert.ok((await state()).books.sidong.scenes[1].bookmark?.line);
  const bookmark=await p.locator('#floating-bookmark').boundingBox(),dock=await p.locator('#mobile-reading-nav').boundingBox();assert.ok(bookmark.y+bookmark.height<dock.y);
  await p.waitForFunction(()=>{const k=Object.keys(localStorage).find(k=>k.startsWith('between-acts:v1:'));const r=JSON.parse(localStorage.getItem(k)).books.sidong.scenes[1].positions.full;return r.line!==null&&Math.abs(r.top-Math.round(scrollY))<2;});const before=(await state()).books.sidong.scenes[1].positions.full;
  await p.reload();await p.waitForSelector('#original-text');await settle();const y=await p.locator('#line-'+before.line).evaluate(e=>e.getBoundingClientRect().top);assert.ok(Math.abs(y-(82+before.delta))<8);await p.locator('#toast').waitFor({state:'hidden'});await p.screenshot({path:path.join(OUT,'phone-original-390.png')});pass('original paragraph and bookmark restore on phone');
  await p.getByRole('button',{name:'장면 목록 열기',exact:true}).click();await p.getByLabel('읽을 작품 선택',{exact:true}).selectOption('temp');await p.waitForURL('**/#temp/1');await settle();
  await p.getByRole('button',{name:'메모 열기',exact:true}).click();await p.getByLabel('작품 전체에서 기억할 내용',{exact:true}).fill('현재 사건과 과거 사고를 나누어 기억');await p.getByRole('button',{name:'메모 닫기',exact:true}).click();await settle();
  await p.locator('.scene-note-box>summary').click();await p.getByLabel('1장면 메모',{exact:true}).fill('가방의 행방');await settle();assert.equal(await p.locator('#mobile-reading-nav').isVisible(),false);await p.locator('h1').click();await settle();assert.equal(await p.locator('#mobile-reading-nav').isVisible(),true);
  await p.reload();await p.waitForSelector('#original-text');assert.match((await state()).books.temp.memory,/사고/);assert.match((await state()).books.temp.scenes[1].note,/가방/);pass('notes, keyboard-safe dock and contents navigation');
  await p.getByRole('button',{name:'읽기 설정 열기',exact:true}).click();await p.getByRole('button',{name:'밤 테마 사용',exact:true}).click();await p.getByRole('button',{name:'이 설정으로 읽기',exact:true}).click();await p.reload();await p.waitForSelector('body.dark');pass('phone night theme persists');
  await p.goto(BASE+'#library');await p.waitForSelector('.book-card');assert.equal(await p.locator('#mobile-reading-nav').isVisible(),false);await noOverflow('library');assert.deepEqual(errors,[]);pass('library has no dock or runtime errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
