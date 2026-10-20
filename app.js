(() => {
  'use strict';
  const books = window.READING_BOOKS;
  const Core = window.ReaderState;
  const $ = id => document.getElementById(id);
  const key = 'between-acts:v1:' + books.map(b => b.sourceHash.slice(0, 16)).join(':');
  let storageAvailable = true;
  let state;
  let route = { book: null, scene: null };
  let restoring = false;
  let saveTimer, toastTimer;
  let dialogReturnFocus = null;
  let settingsReturnFocus = null;
  const phoneLayout = matchMedia('(max-width:760px)');

  function storageWarning(message) {
    storageAvailable = false;
    $('storage-warning').textContent = message;
    $('storage-warning').hidden = false;
  }
  try {
    const raw = localStorage.getItem(key);
    state = raw ? Core.normalize(JSON.parse(raw), books) : Core.fresh(books);
  } catch (error) {
    state = Core.fresh(books);
    storageWarning('저장된 진도를 불러오지 못했어요. 이번 기록은 진도 백업으로 보관해 주세요.');
  }
  function persist() {
    if (!storageAvailable) return false;
    try { localStorage.setItem(key, JSON.stringify(state)); return true; }
    catch { storageWarning('브라우저 저장 공간을 사용할 수 없어요. 페이지를 닫기 전에 진도를 백업해 주세요.'); return false; }
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2800);
  }
  function el(tag, cls, text) {
    const element = document.createElement(tag);
    if (cls) element.className = cls;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function button(text, cls, action) {
    const b = el('button', 'button ' + (cls || ''), text);
    b.addEventListener('click', action);
    return b;
  }
  function link(text, href, cls = '') {
    const a = el('a', cls, text);
    a.href = href;
    return a;
  }
  function progressBar(value, total) {
    const track = el('div', 'progress-track');
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', String(total));
    track.setAttribute('aria-valuenow', String(value));
    track.setAttribute('aria-label', '읽은 원문 장면');
    const fill = el('span'); fill.style.width = `${value / total * 100}%`; track.append(fill); return track;
  }
  function currentProgress() { return route.book ? state.books[route.book.id].scenes[route.scene.number] : null; }
  function topOffset() { return document.querySelector('.topbar').getBoundingClientRect().height + 22; }
  function capturePosition() {
    if (!route.book || restoring) return null;
    const mode = 'full';
    const ps = [...document.querySelectorAll('#original-text p[data-line]')];
    const first = ps.find(p => p.getBoundingClientRect().bottom > topOffset());
    const inScript = mode === 'full' && first && $('original').getBoundingClientRect().top < topOffset();
    const fullHeight = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const p = { line: inScript ? Number(first.dataset.line) : null,
      delta: inScript ? first.getBoundingClientRect().top - topOffset() : 0,
      top: Math.round(scrollY), percent: Math.min(100, Math.round(scrollY / fullHeight * 100)) };
    currentProgress().positions[mode] = p;
    return p;
  }
  function savePosition() { capturePosition(); persist(); }
  function restorePosition(p) {
    restoring = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const target = p?.line ? $('line-' + p.line) : null;
      const y = target ? target.getBoundingClientRect().top + scrollY - topOffset() - (p.delta || 0) : p?.top || 0;
      scrollTo({ top: y, behavior: 'instant' });
      requestAnimationFrame(() => { restoring = false; });
    }));
  }
  function closeToc() { document.body.classList.remove('toc-open'); $('sidebar-shade').hidden = true; $('toc-toggle').setAttribute('aria-expanded', 'false'); }
  function navigate(bookId, number) {
    savePosition(); closeToc();
    const next = `#${bookId}/${number}`;
    if (location.hash === next) renderRoute(); else location.hash = next;
  }
  function applySettings() {
    document.documentElement.style.setProperty('--read-size', state.settings.fontSize + 'px');
    document.body.classList.toggle('dark', state.settings.theme === 'dark');
    document.body.classList.toggle('character-colors', state.settings.characterColors);
    $('character-colors').checked = state.settings.characterColors;
    $('settings-font-size').textContent = state.settings.fontSize + 'px';
    $('font-slider').value = state.settings.fontSize;
    $('settings-font-down').disabled = state.settings.fontSize <= 12;
    $('settings-font-up').disabled = state.settings.fontSize >= 32;
    $('settings-theme').textContent = state.settings.theme === 'dark' ? '종이 테마로 바꾸기' : '밤 테마 사용';
    $('settings-theme').setAttribute('aria-pressed', String(state.settings.theme === 'dark'));
  }
  function renderPhoneNavigation() {
    document.body.classList.toggle('has-reader', Boolean(route.book));
    const nav=$('mobile-reading-nav');nav.replaceChildren();nav.hidden=!route.book;
    $('context-open').textContent='메모';
    if(!route.book)return;
    const s=route.scene,book=route.book;
    const previous=button('← 이전','mobile-prev',()=>navigate(book.id,s.number-1));
    previous.setAttribute('aria-label','모바일 이전 장면');previous.disabled=s.number===1;
    const count=el('span','mobile-scene-count',`${s.number} / ${book.scenes.length}`);count.setAttribute('aria-label',`현재 ${s.number}장면, 전체 ${book.scenes.length}장면`);
    const last=s.number===book.scenes.length;
    const next=button(last?'서재로 →':'다음 →','primary mobile-next',goNextScene);
    next.setAttribute('aria-label',last?'모바일 서재로 이동':'모바일 다음 장면');
    nav.append(previous,count,next);
  }
  function footerActions() {
    const foot = el('div', 'side-footer');
    foot.append(el('p', '', '진도·메모는 이 브라우저에 저장돼요.\n다른 기기에서는 백업 파일을 불러오세요.'));
    const row = el('div', 'side-actions');
    const out = el('button', 'text-button', '진도 백업'); out.onclick = exportProgress;
    const imp = el('button', 'text-button', '백업 불러오기'); imp.onclick = () => $('import-file').click();
    row.append(out, imp); foot.append(row); return foot;
  }
  function renderSidebar() {
    const sidebar = $('sidebar'); sidebar.replaceChildren();
    if (!route.book) {
      sidebar.append(el('p', 'side-library-title', '대본 목록'));
      const nav = link('', '#library', 'library-nav active'); nav.append(el('span', 'dot'), '나의 서재'); sidebar.append(nav);
      books.forEach(b => sidebar.append(link(b.title, `#${b.id}/${state.books[b.id].lastScene}`, 'library-nav')));
    } else {
      const book = route.book, stats = Core.progress(book, state);
      const sh = el('div', 'side-heading'); sh.append(el('span', 'eyebrow', 'CONTENTS'), link('← 서재', '#library')); sidebar.append(sh);
      const select = el('select', 'book-select'); select.setAttribute('aria-label', '읽을 작품 선택');
      books.forEach(b => { const o = el('option', '', b.title); o.value = b.id; o.selected = b.id === book.id; select.append(o); });
      select.onchange = () => navigate(select.value, state.books[select.value].lastScene); sidebar.append(select);
      const stat = el('div', 'side-stats');
      const row = el('div', 'stats-line'); row.append(el('span', '', '원문 읽음'), el('strong', '', `${stats.full} / ${stats.total} 장면`));
      stat.append(row, progressBar(stats.full, stats.total), el('p', 'note-status', `요약 확인 ${stats.summary} / ${stats.total} · ✓ 원문  ◐ 요약`)); sidebar.append(stat);
      const nav = el('nav', 'scene-list'); nav.setAttribute('aria-label', book.title + ' 장면');
      book.scenes.forEach(s => {
        const saved = state.books[book.id].scenes[s.number];
        const a = link('', `#${book.id}/${s.number}`, 'scene-link' + (saved.done ? ' done' : ''));
        if (s.number === route.scene.number) a.setAttribute('aria-current', 'page');
        a.append(el('span', 'scene-num', String(s.number).padStart(2, '0')), el('span', 'scene-name', s.title), el('span', 'scene-state', saved.done ? '✓' : saved.summaryDone ? '◐' : '○'));
        a.setAttribute('aria-label', `${s.number}장면 ${s.title}, ${saved.done ? '원문 읽음' : saved.summaryDone ? '요약 확인' : '미확인'}`);
        nav.append(a);
      }); sidebar.append(nav);
    }
    sidebar.append(footerActions());
  }
  function renderLibrary() {
    $('floating-bookmark').hidden = true;
    document.title = '막과 막 사이 · 나의 서재';
    const wrap = el('div', 'page-wrap');
    const hero = el('section', 'library-hero');hero.append(el('h1','','대본 읽기'),el('p','','장면별 요약과 원문을 읽고, 읽던 곳에서 이어가세요.'));wrap.append(hero);
    const label = el('div', 'library-label'); label.append(el('strong', '', '대본 목록'), el('span', '', '2개 작품 · 22개 장면')); wrap.append(label);
    const grid = el('div', 'books-grid');
    books.forEach((book, index) => {
      const saved = state.books[book.id], p = Core.progress(book, state);
      const card = el('article', 'book-card'), cover = el('div', 'book-cover ' + book.id);
      cover.append(el('h2', '', book.title), el('p', '', book.subtitle));
      card.append(cover);
      const body = el('div', 'book-body'), meta = el('div', 'book-meta');
      meta.append(el('span', 'pill', `${book.scenes.length}개 장면`), el('span', 'pill', `등장인물 ${book.characters.length}명`), el('span', 'pill', `${(book.chars / 10000).toFixed(1)}만 자`));
      body.append(meta, el('p', '', book.description));
      const stat = el('div', 'stats-line'); stat.append(el('span', '', `원문 ${p.full}/${p.total} · 요약 ${p.summary}/${p.total}`), el('strong', '', Math.round(p.full / p.total * 100) + '%')); body.append(stat, progressBar(p.full, p.total));
      const visited = Object.values(saved.scenes).some(s => s.visited);
      body.append(button(visited ? '읽던 장면 이어보기  →' : '대본 읽기  →', 'primary', () => navigate(book.id, saved.lastScene)));
      body.append(el('p', 'resume-note', visited ? `${saved.lastScene}장면 · ${book.scenes[saved.lastScene - 1].title}` : '요약 확인과 원문 읽음은 따로 기록해요'));
      card.append(body); grid.append(card);
    }); wrap.append(grid);
    wrap.append(el('p', 'library-footnote', '진도와 메모는 이 브라우저에 저장됩니다. 다른 기기로 옮길 때는 진도 백업을 이용하세요.'));
    $('main').replaceChildren(wrap);
    renderPhoneNavigation();
  }
  function goNextScene() {
    if(route.scene.number<route.book.scenes.length)navigate(route.book.id,route.scene.number+1);
    else{savePosition();location.hash='#library';}
  }
  function makeNoteInput(value, labelText, onInput) {
    const box = el('div'), label = el('label', 'note-label', labelText), input = el('textarea', 'note-input');
    input.maxLength = 16000; input.value = value; input.placeholder = '이 장면에서 달라진 것, 기억할 말, 아직 궁금한 점…';
    const id = 'note-' + Math.random().toString(36).slice(2, 9); input.id = id; label.htmlFor = id;
    const status = el('p', 'note-status', storageAvailable ? '입력하면 자동 저장돼요.' : '진도 백업으로 보관해 주세요.');
    input.addEventListener('input', () => { onInput(input.value); status.textContent = persist() ? '저장됨 · 이 브라우저에 보관 중' : '저장 공간을 사용할 수 없어요. 진도를 백업해 주세요.'; });
    box.append(label, input, status); return box;
  }
  function renderReader() {
    const book=route.book,s=route.scene,saved=currentProgress();
    $('floating-bookmark').hidden=false;
    document.title=`${book.title} ${s.number}장면 · 막과 막 사이`;
    const wrap=el('div','reader-wrap');
    const crumb=el('div','reader-breadcrumb');crumb.append(link('← 대본 목록','#library'));wrap.append(crumb);
    const hero=el('header','scene-heading');
    hero.append(el('p','scene-kicker',`${book.title} · ${s.number} / ${book.scenes.length}장면`),el('h1','',s.title));wrap.append(hero);
    const summary=el('details','scene-overview');summary.id='scene-summary';summary.open=saved.summaryOpen;
    const summaryToggle=el('summary'),summaryHint=el('span','overview-hint',summary.open?'접기':'펼치기');summaryToggle.append(el('span','','장면 요약'),summaryHint);summary.append(summaryToggle);
    const summaryText=el('div','overview-text');s.summary.forEach(text=>summaryText.append(el('p','',text)));summary.append(summaryText);
    const focus=el('details','learning-guide');focus.append(el('summary','','이해를 돕는 포인트'));
    const list=el('ul');s.focus.forEach(text=>list.append(el('li','',text)));focus.append(list,el('p','reading-question',s.question));summary.append(focus);
    const summaryLabel=el('label','completion-control summary-completion'),summaryCheck=el('input');summaryCheck.type='checkbox';summaryCheck.checked=saved.summaryDone;
    summaryLabel.append(summaryCheck,el('span','','이 장면 요약 읽음'));summaryCheck.onchange=()=>{saved.summaryDone=summaryCheck.checked;persist();renderSidebar();};summary.append(summaryLabel);
    summary.ontoggle=()=>{saved.summaryOpen=summary.open;summaryHint.textContent=summary.open?'접기':'펼치기';persist();if(!restoring)savePosition();};wrap.append(summary);
    const recap=el('details','recap-box');recap.append(el('summary','','이전 내용 · 등장인물 다시 보기'),el('p','',s.before));
    const cast=el('details','cast-recap');cast.append(el('summary','','등장인물'));const castList=el('dl','cast-list');book.characters.forEach(([name,description])=>castList.append(el('dt','',name),el('dd','',description)));cast.append(castList);recap.append(cast);wrap.append(recap);
    const panel=el('section','reading-panel');panel.id='reading-panel';panel.setAttribute('aria-label','대본 원문');
      const original=el('article','original');original.id='original';original.setAttribute('aria-label',`${book.title} ${s.number}장면 원문`);
      const head=el('div','panel-heading');head.append(el('h2','','대본 원문'),el('span','panel-kind','원문'));
      if(saved.bookmark)head.append(button('저장한 책갈피로 이동','bookmark-return',()=>restorePosition(saved.bookmark)));original.append(head);
      if(s.number===1){const intro=el('details','source-details');intro.append(el('summary','','등장인물과 무대 설정 · 원문'),el('div','intro-text',book.intro.map(line=>line.text).join('\n')));original.append(intro);}
      const script=el('div','script');script.id='original-text';
      s.lines.forEach(line=>{const paragraph=el('p',line.speaker?'dialogue':'direction');paragraph.dataset.line=String(line.number);paragraph.id='line-'+line.number;
        if(line.speaker){const separator=line.text.slice(line.speaker.length,line.text.length-line.body.length);paragraph.append(el('strong','speaker',line.speaker+separator),el('span','body',line.body));}else paragraph.textContent=line.text;
        script.append(paragraph);});original.append(script);panel.append(original);
    const completion=el('div','completion-strip');
    const label=el('label','completion-control'),checkbox=el('input');checkbox.id='scene-complete';checkbox.type='checkbox';checkbox.checked=saved.done;
    label.append(checkbox,el('span','','이 장면 원문 읽음'));
    const status=el('span','completion-status',checkbox.checked?'진도에 저장됨':'체크하면 진도에 저장됩니다');
    checkbox.onchange=()=>{saved.done=checkbox.checked;persist();status.textContent=checkbox.checked?'진도에 저장됨':'읽음 표시 해제됨';renderSidebar();};
    completion.append(label,status);panel.append(completion);wrap.append(panel);
    const memo=el('details','scene-note-box');memo.open=Boolean(saved.note);memo.append(el('summary','','내 메모'+(saved.note?' · 저장된 메모 있음':'')));
    memo.append(makeNoteInput(saved.note,`${s.number}장면 메모`,value=>{saved.note=value;}));wrap.append(memo);
    const navigation=el('nav','next-row');navigation.setAttribute('aria-label','장면 이동');
    const previous=button('← 이전 장면','',()=>navigate(book.id,s.number-1));previous.disabled=s.number===1;
    navigation.append(previous,el('span','navigation-count',`${s.number} / ${book.scenes.length}`),button(s.number===book.scenes.length?'대본 목록으로 →':'다음 장면 →','primary',goNextScene));wrap.append(navigation);
    wrap.append(el('p','reader-footer','읽음 표시는 체크박스에서, 장면 이동은 이전·다음 버튼에서 할 수 있어요.'));
    colorSpeakerNames(wrap,book);
    $('main').replaceChildren(wrap);highlightBookmark();renderPhoneNavigation();
  }
  function colorSpeakerNames(root,book) {
    // Explicit source spelling variants share the canonical character's color.
    const variants=book.id==='sidong'
      ? [['임공우','입공우','공우'],['강정옥','강정욱','강경옥','강정우','정옥'],['성현기','성전기','현기'],['고상오','고장오','상오'],['김갑원','김감원','김갑천','갑원'],['박승조','승조']]
      : [['오한구','한구'],['최철민','최철미','철민'],['김수정','수정'],['신반장','신 반장','신팀장'],['장형사','장 형사']];
    const colors=new Map(variants.flatMap((names,index)=>names.map(name=>[name,index])));
    const pattern=new RegExp([...colors.keys()].sort((a,b)=>b.length-a.length).join('|'),'g');
    root.querySelectorAll('.speaker').forEach(section=>{
      const walker=document.createTreeWalker(section,NodeFilter.SHOW_TEXT),nodes=[];
      while(walker.nextNode())nodes.push(walker.currentNode);
      nodes.forEach(node=>{
        const text=node.textContent,parts=document.createDocumentFragment();let start=0;
        for(const match of text.matchAll(pattern)){
          parts.append(document.createTextNode(text.slice(start,match.index)));
          const name=el('span','character-name character-'+colors.get(match[0]),match[0]);
          name.dataset.character=book.characters[colors.get(match[0])][0];parts.append(name);start=match.index+match[0].length;
        }
        if(start){parts.append(document.createTextNode(text.slice(start)));node.replaceWith(parts);}
      });
    });
  }
  function highlightBookmark() {
    document.querySelectorAll('.bookmarked').forEach(x=>x.classList.remove('bookmarked'));
    const saved=currentProgress();if(saved?.bookmark)$('line-'+saved.bookmark.line)?.classList.add('bookmarked');
  }
  function renderRoute() {
    clearTimeout(saveTimer);
    route=Core.parseRoute(location.hash,books);
    if(route.book) {const b=state.books[route.book.id];b.lastScene=route.scene.number;currentProgress().visited=true;state.last={bookId:route.book.id,scene:route.scene.number};renderReader();}
    else renderLibrary();
    renderSidebar();closeToc();persist();
    if(route.book)restorePosition(currentProgress().positions[state.settings.mode]);else restorePosition({top:0});
  }
  function renderContext() {
    const content=$('context-content');content.replaceChildren();
    const book=route.book||books.find(b=>b.id===state.last?.bookId)||books[0];
    const bstate=state.books[book.id];
    content.append(el('p','dialog-note',`${book.title} · ${route.book ? route.scene.number+'장면을 읽는 중' : '내가 남긴 기록'}`));
    const memory=el('section','dialog-section');memory.append(el('h3','','작품 전체 메모'));
    memory.append(makeNoteInput(bstate.memory,'작품 전체에서 기억할 내용',value=>{bstate.memory=value;}));content.append(memory);
    if(route.scene){const sec=el('section','dialog-section');sec.append(el('h3','',`${route.scene.number}장면의 메모`));sec.append(makeNoteInput(currentProgress().note,'이 장면 메모',value=>{currentProgress().note=value;const inline=$('main').querySelector('textarea');if(inline)inline.value=value;}));content.append(sec);}
    const notes=el('section','dialog-section');notes.append(el('h3','','이전 장면에 남긴 메모'));
    const noted=book.scenes.filter(s=>bstate.scenes[s.number].note&&(!route.scene||s.number<route.scene.number));
    if(!noted.length)notes.append(el('p','no-notes','아직 이전 장면 메모가 없어요. 장면마다 한 줄씩 남겨보세요.'));
    noted.forEach(s=>{const item=el('div','memo-item'),a=link(`${s.number}장면 · ${s.title}`,`#${book.id}/${s.number}`,'memo-link');a.onclick=closeContext;item.append(a,el('p','',bstate.scenes[s.number].note));notes.append(item);});content.append(notes);
    content.append(el('p','dialog-note','메모와 진도는 이 브라우저에 저장됩니다. 기기 간 자동 동기화는 하지 않습니다.'));
  }
  function openContext() {dialogReturnFocus=document.activeElement;renderContext();$('context-dialog').showModal();document.body.classList.add('dialog-open');}
  function closeContext() {$('context-dialog').close();dialogReturnFocus?.focus();}
  function openSettings(){settingsReturnFocus=document.activeElement;applySettings();$('settings-dialog').showModal();$('settings-dialog').scrollTop=0;document.body.classList.add('dialog-open');}
  function closeSettings(){$('settings-dialog').close();settingsReturnFocus?.focus();}
  function exportProgress() {
    savePosition();const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
    const a=link('',url);a.download='대본독서실-진도-'+new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date())+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('진도와 메모를 백업했어요. 대본 원문은 포함하지 않습니다.');
  }
  $('import-file').onchange=async event=>{
    const file=event.target.files[0];if(!file)return;
    try {
      if(file.size>1048576)throw new Error('1MB 이하의 진도 백업 파일을 선택해 주세요.');
      const candidate=Core.normalize(JSON.parse(await file.text()),books,true);
      savePosition();
      // Preserve the current valid snapshot before applying an explicit import.
      if(storageAvailable) {try{localStorage.setItem(key+':before-import',JSON.stringify(state));}catch{}}
      state=candidate;route={book:null,scene:null};persist();applySettings();
      history.replaceState(null,'',state.last?`#${state.last.bookId}/${state.last.scene}`:'#library');
      renderRoute();toast('백업한 진도와 메모를 불러왔어요.');
    }catch(error){toast(error.message||'진도 파일을 읽을 수 없어요. 현재 기록은 그대로입니다.');}
    event.target.value='';
  };
  function setFontSize(size){const p=capturePosition()||(route.book?currentProgress().positions[state.settings.mode]:null);state.settings.fontSize=Core.bounded(size,12,32,18);applySettings();persist();if(route.book)restorePosition(p);}
  function changeFont(delta){setFontSize(state.settings.fontSize+delta);}
  function toggleTheme(){state.settings.theme=state.settings.theme==='dark'?'paper':'dark';applySettings();persist();}
  $('settings-theme').onclick=toggleTheme;
  $('character-colors').onchange=event=>{state.settings.characterColors=event.target.checked;applySettings();persist();};
  $('settings-font-down').onclick=()=>changeFont(-1);$('settings-font-up').onclick=()=>changeFont(1);
  $('font-slider').oninput=event=>setFontSize(Number(event.target.value));
  $('settings-open').onclick=openSettings;$('settings-close').onclick=closeSettings;$('settings-done').onclick=closeSettings;
  $('floating-bookmark').onclick=()=>{
    const p=capturePosition();
    if(!p?.line){toast('책갈피를 남길 원문 문단으로 먼저 이동해 주세요.');return;}
    currentProgress().bookmark={...p};persist();highlightBookmark();toast('현재 원문 문단에 책갈피를 남겼어요.');
  };
  $('toc-toggle').onclick=()=>{const open=!document.body.classList.contains('toc-open');document.body.classList.toggle('toc-open',open);$('sidebar-shade').hidden=!open;$('toc-toggle').setAttribute('aria-expanded',String(open));};
  $('sidebar-shade').onclick=closeToc;
  $('context-open').onclick=openContext;$('context-close').onclick=closeContext;
  $('context-dialog').addEventListener('click',event=>{if(event.target===$('context-dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeContext();}});
  $('settings-dialog').addEventListener('click',event=>{if(event.target===$('settings-dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeSettings();}});
  ['settings-dialog','context-dialog'].forEach(id=>$(id).addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.classList.remove('dialog-open');}));
  phoneLayout.addEventListener('change',()=>{closeToc();renderPhoneNavigation();});
  document.addEventListener('focusin',event=>{if(event.target.tagName==='TEXTAREA')document.body.classList.add('editing-note');});
  document.addEventListener('focusout',()=>requestAnimationFrame(()=>document.body.classList.toggle('editing-note',document.activeElement?.tagName==='TEXTAREA')));
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeToc();});
  window.addEventListener('hashchange',()=>{savePosition();renderRoute();});
  window.addEventListener('scroll',()=>{if(restoring||!route.book)return;clearTimeout(saveTimer);saveTimer=setTimeout(savePosition,180);},{passive:true});
  window.addEventListener('pagehide',savePosition);document.addEventListener('visibilitychange',()=>{if(document.hidden)savePosition();});
  if('scrollRestoration' in history)history.scrollRestoration='manual';
  applySettings();
  if(!location.hash&&state.last)history.replaceState(null,'',`#${state.last.bookId}/${state.last.scene}`);
  renderRoute();
})();
