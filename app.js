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
    track.setAttribute('aria-label', '확인한 요약 장면');
    const fill = el('span'); fill.style.width = `${value / total * 100}%`; track.append(fill); return track;
  }
  function currentProgress() { return route.book ? state.books[route.book.id].scenes[route.scene.number] : null; }
  function topOffset() { return document.querySelector('.topbar').getBoundingClientRect().height + 22; }
  function capturePosition() {
    if (!route.book || restoring) return null;
    const mode = state.settings.mode;
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
    $('font-size').value = state.settings.fontSize;
    $('font-size').textContent = state.settings.fontSize;
    $('font-down').disabled = state.settings.fontSize <= 16;
    $('font-up').disabled = state.settings.fontSize >= 32;
    $('theme-toggle').textContent = state.settings.theme === 'dark' ? '낮' : '밤';
    $('theme-toggle').setAttribute('aria-pressed', String(state.settings.theme === 'dark'));
    $('theme-toggle').setAttribute('aria-label', state.settings.theme === 'dark' ? '종이 테마로 변경' : '밤 테마로 변경');
    $('settings-font-size').textContent = state.settings.fontSize + 'px';
    $('font-slider').value = state.settings.fontSize;
    $('settings-font-down').disabled = state.settings.fontSize <= 16;
    $('settings-font-up').disabled = state.settings.fontSize >= 32;
    $('settings-theme').textContent = state.settings.theme === 'dark' ? '종이 테마로 바꾸기' : '밤 테마 사용';
    $('settings-theme').setAttribute('aria-pressed', String(state.settings.theme === 'dark'));
  }
  function renderPhoneNavigation() {
    document.body.classList.toggle('has-reader', Boolean(route.book));
    document.body.classList.toggle('summary-mode', state.settings.mode==='summary');
    const nav=$('mobile-reading-nav');nav.replaceChildren();nav.hidden=!route.book;
    $('context-open').textContent=phoneLayout.matches?(route.book?'맥락':'메모'):(route.book?'맥락 · 메모 ↗':'내 메모 ↗');
    if(!route.book)return;
    const s=route.scene,book=route.book;
    const previous=button('← 이전','mobile-prev',()=>navigate(book.id,s.number-1));
    previous.setAttribute('aria-label','모바일 이전 장면');previous.disabled=s.number===1;
    const count=el('span','mobile-scene-count',`${s.number} / ${book.scenes.length}`);count.setAttribute('aria-label',`현재 ${s.number}장면, 전체 ${book.scenes.length}장면`);
    const last=s.number===book.scenes.length;
    const next=button((state.settings.mode==='summary'?'요약 확인 · ':'원문 읽음 · ')+(last?'서재 →':'다음 →'),'primary mobile-next',()=>markCurrent(true));
    next.setAttribute('aria-label',(state.settings.mode==='summary'?'요약 확인':'원문 읽음')+' 표시하고 '+(last?'서재로 이동':'다음 장면으로 이동'));
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
      sidebar.append(el('div', 'eyebrow', 'MY READING ROOM'));
      const title = el('p', 'side-library-title'); title.append('한 장면씩,', el('br'), '이야기 안으로.'); sidebar.append(title);
      sidebar.append(el('p', 'side-library-note', '요약으로 흐름을 잡고\n궁금한 장면은 원문으로 깊이 읽어요.'));
      const nav = link('', '#library', 'library-nav active'); nav.append(el('span', 'dot'), '나의 서재'); sidebar.append(nav);
      books.forEach(b => sidebar.append(link(b.title, `#${b.id}/${state.books[b.id].lastScene}`, 'library-nav')));
    } else {
      const book = route.book, stats = Core.progress(book, state);
      const sh = el('div', 'side-heading'); sh.append(el('span', 'eyebrow', 'CONTENTS'), link('← 서재', '#library')); sidebar.append(sh);
      const select = el('select', 'book-select'); select.setAttribute('aria-label', '읽을 작품 선택');
      books.forEach(b => { const o = el('option', '', b.title); o.value = b.id; o.selected = b.id === book.id; select.append(o); });
      select.onchange = () => navigate(select.value, state.books[select.value].lastScene); sidebar.append(select);
      const stat = el('div', 'side-stats');
      const row = el('div', 'stats-line'); row.append(el('span', '', '요약 확인'), el('strong', '', `${stats.summary} / ${stats.total} 장면`));
      stat.append(row, progressBar(stats.summary, stats.total), el('p', 'note-status', `원문 읽음 ${stats.full} / ${stats.total} · ✓ 원문  ◐ 요약`)); sidebar.append(stat);
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
    const hero = el('section', 'library-hero'); hero.append(el('span', 'eyebrow', 'BETWEEN THE ACTS'));
    const h = el('h1'); h.append('이야기의 흐름을,', el('br'), el('em', '', '내 속도로 이해하기.')); hero.append(h);
    hero.append(el('p', '', '요약으로 먼저 연결하고, 원문으로 이해를 채워요.\n읽던 자리와 떠오른 생각은 여기에 남아 있어요.')); wrap.append(hero);
    const label = el('div', 'library-label'); label.append(el('strong', '', '오늘의 대본'), el('span', '', '2개 작품 · 22개 장면')); wrap.append(label);
    const grid = el('div', 'books-grid');
    books.forEach((book, index) => {
      const saved = state.books[book.id], p = Core.progress(book, state);
      const card = el('article', 'book-card'), cover = el('div', 'book-cover ' + book.id);
      cover.append(el('span', 'cover-no', `READING NO. ${String(index + 1).padStart(2, '0')}`), el('h2', '', book.title), el('p', '', book.subtitle), el('span', 'cover-tag', 'SCRIPT READER'));
      card.append(cover);
      const body = el('div', 'book-body'), meta = el('div', 'book-meta');
      meta.append(el('span', 'pill', `${book.scenes.length}개 장면`), el('span', 'pill', `등장인물 ${book.characters.length}명`), el('span', 'pill', `${(book.chars / 10000).toFixed(1)}만 자`));
      body.append(meta, el('p', '', book.description));
      const stat = el('div', 'stats-line'); stat.append(el('span', '', `요약 ${p.summary}/${p.total} · 원문 ${p.full}/${p.total}`), el('strong', '', Math.round(p.summary / p.total * 100) + '%')); body.append(stat, progressBar(p.summary, p.total));
      const visited = Object.values(saved.scenes).some(s => s.visited);
      body.append(button(visited ? '읽던 장면 이어보기  →' : '요약부터 읽기  →', 'primary', () => navigate(book.id, saved.lastScene)));
      body.append(el('p', 'resume-note', visited ? `${saved.lastScene}장면 · ${book.scenes[saved.lastScene - 1].title}` : '요약 확인과 원문 읽음은 따로 기록해요'));
      card.append(body); grid.append(card);
    }); wrap.append(grid);
    const guide = el('section', 'reading-guide'); guide.append(el('h2', '', '이해가 이어지는 세 단계'));
    const gg = el('div', 'guide-grid');
    [['01', '요약으로 흐름 잡기', '장면에서 일어나는 사건과 변화를 먼저 읽어요.'], ['02', '필요한 원문 펼치기', '말투와 행동이 궁금할 때 요약 + 원문으로 전환해요.'], ['03', '맥락과 메모로 이어가기', '이전 흐름과 내 메모를 보고 읽던 문단으로 돌아와요.']].forEach(([n,t,d]) => { const x = el('div'), title = el('b'); title.append(el('span','step',n),t); x.append(title,el('span','',d)); gg.append(x); }); guide.append(gg); wrap.append(guide);
    wrap.append(el('p', 'library-footnote', '원문은 제공된 HWP에서 추출했고 표기와 오탈자를 유지했습니다. 장면 제목·요약·읽기 포인트는 이해를 돕기 위해 덧붙였습니다. 요약에는 해당 장면의 전개가 포함됩니다.\n자동 저장은 현재 브라우저에 적용됩니다. 기기를 바꾸거나 브라우저 데이터를 지우기 전에는 진도 백업을 이용하세요.'));
    $('main').replaceChildren(wrap);
    renderPhoneNavigation();
  }
  function setMode(mode) {
    if (state.settings.mode === mode) return;
    savePosition(); state.settings.mode = mode; persist(); renderReader(); renderSidebar();
    restorePosition(currentProgress().positions[mode]);
  }
  function markCurrent(next = false) {
    const saved = currentProgress();
    if (state.settings.mode === 'summary') saved.summaryDone = true;
    else { saved.done = true; saved.summaryDone = true; }
    persist(); renderSidebar();
    if (next) {
      if (route.scene.number < route.book.scenes.length) navigate(route.book.id, route.scene.number + 1);
      else { savePosition(); location.hash = '#library'; toast('마지막 장면을 기록했어요. 진도는 서재에서 확인할 수 있어요.'); }
    } else { const p = capturePosition(); renderReader(); restorePosition(p); }
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
    const book = route.book, s = route.scene, saved = currentProgress(), mode = state.settings.mode;
    $('floating-bookmark').hidden = mode !== 'full';
    document.title = `${book.title} ${s.number}장면 · 막과 막 사이`;
    const wrap = el('div', 'reader-wrap');
    const crumb = el('div', 'reader-breadcrumb'); crumb.append(link('← 나의 서재', '#library'), el('span', '', book.setting)); wrap.append(crumb);
    const hero = el('section', 'scene-hero'); hero.append(el('span', 'scene-kicker', `${book.title}  /  SCENE ${String(s.number).padStart(2,'0')} OF ${String(book.scenes.length).padStart(2,'0')}`), el('h1', '', s.title));
    const modeRow = el('div', 'mode-switch'); modeRow.setAttribute('role', 'group'); modeRow.setAttribute('aria-label', '읽기 방식');
    ['summary','full'].forEach(m => { const b = button(m === 'summary' ? '요약 중심' : '요약 + 원문', mode === m ? 'primary' : '', () => setMode(m)); b.setAttribute('aria-pressed', String(mode === m)); modeRow.append(b); }); hero.append(modeRow);
    const actions = el('div', 'scene-actions');
    const done = mode === 'summary' ? saved.summaryDone || saved.done : saved.done;
    const d = button(done ? (mode === 'summary' ? '✓ 요약 확인함' : '✓ 원문 읽음') : (mode === 'summary' ? '요약 확인 표시' : '원문 읽음 표시'), 'done-button', () => {
      if (mode === 'summary') saved.summaryDone = !saved.summaryDone;
      else saved.done = !saved.done;
      persist(); const p=capturePosition(); renderSidebar(); renderReader(); restorePosition(p);
    }); d.setAttribute('aria-pressed', String(done)); actions.append(d);
    if(mode === 'summary' && saved.done){d.textContent='✓ 원문까지 읽음';d.disabled=true;d.title='원문을 읽은 장면입니다. 원문 모드에서 읽음 표시를 변경할 수 있어요.';}
    if (saved.bookmark) actions.append(button('책갈피로 이동 ↗', '', () => {
      if (state.settings.mode !== 'full') { savePosition(); state.settings.mode = 'full'; persist(); renderReader(); }
      restorePosition(saved.bookmark);
    }));
    hero.append(actions);
    const pos = saved.positions[mode];
    const ln = el('p', 'location-note'); ln.append(el('span','saved-dot'), storageAvailable ? `읽던 위치 자동 저장${pos.top > 80 ? ` · 마지막 위치 ${Math.round(pos.percent)}%` : ''}` : '이 브라우저에서 자동 저장을 사용할 수 없어요'); hero.append(ln); wrap.append(hero);
    const tabs = el('nav', 'reading-tabs'); tabs.setAttribute('aria-label','현재 장면 바로가기');
    const summaryJump = link('먼저 읽는 요약', '#'); summaryJump.onclick = e => { e.preventDefault(); $('scene-summary').scrollIntoView({behavior:'instant'}); };
    tabs.append(summaryJump);
    if(mode === 'full') { const a=link('대본 원문', '#');a.onclick=e=>{e.preventDefault();$('original').scrollIntoView({behavior:'instant'});};a.append(el('span','',`${s.lines.length}문단`));tabs.append(a); }
    wrap.append(tabs);
    const before = el('section','before-context'); before.append(el('h2','',s.number === 1 ? '이야기에 들어가기' : '이전 장면까지의 맥락'),el('p','',s.before)); wrap.append(before);
    const summary = el('section','summary-card'); summary.id='scene-summary';
    const sh=el('div','section-head');sh.append(el('h2','','먼저 읽는 요약'),el('span','small-tag','이 장면의 전개 포함'));summary.append(sh);
    s.summary.forEach(t=>summary.append(el('p','',t)));wrap.append(summary);
    const focus=el('details','focus-box');focus.open=true;focus.append(el('summary','','이 두 가지를 연결하며 읽어요'));
    const ul=el('ul');s.focus.forEach(t=>ul.append(el('li','',t)));focus.append(ul);wrap.append(focus);
    if(mode==='summary') {
      const expand=button('이 장면 원문도 읽기  ↓','expand-original',()=>{setMode('full');requestAnimationFrame(()=>requestAnimationFrame(()=>$('original').scrollIntoView({behavior:'instant'})));});wrap.append(expand);
    } else {
      const original=el('article','original');original.id='original';original.setAttribute('aria-label',`${book.title} ${s.number}장면 원문`);
      const oh=el('div','original-header');oh.append(el('h2','','대본 원문'),el('span','',`${s.heading.replace(/\t/g,' ')} · 원문 표기 유지`));original.append(oh);
      if(s.number===1) {const intro=el('details','source-details');intro.append(el('summary','','등장인물과 무대 설정 · 원문 보기'),el('div','intro-text',book.intro.map(l=>l.text).join('\n')));original.append(intro);}
      const text=el('div','script');text.id='original-text';
      s.lines.forEach(line=>{const p=el('p',line.speaker?'dialogue':'direction');p.dataset.line=String(line.number);p.id='line-'+line.number;
        if(line.speaker) p.append(el('strong','speaker',line.speaker),el('span','body',line.body));else p.textContent=line.text;
        text.append(p);});original.append(text);wrap.append(original);
    }
    const end=el('section','scene-end');end.append(el('span','eyebrow','TAKE A MOMENT'),el('h2','',s.question));
    end.append(makeNoteInput(saved.note,`${s.number}장면 · 나의 이해 메모`,value=>{saved.note=value;}));
    const row=el('nav','next-row');row.setAttribute('aria-label','장면 이동');
    const prev=button('← 이전 장면','',()=>navigate(book.id,s.number-1));prev.disabled=s.number===1;
    row.append(prev,button(mode==='summary'?'요약 확인하고 '+(s.number===book.scenes.length?'서재로 →':'다음 장면 →'):'원문 읽음 표시하고 '+(s.number===book.scenes.length?'서재로 →':'다음 장면 →'),'primary',()=>markCurrent(true)));end.append(row);
    end.append(el('p','completion-hint','진도 표시는 직접 눌러 기록해요. 요약 확인과 원문 읽음은 따로 저장됩니다.'));
    wrap.append(end,el('p','reader-footer',`장면 제목·요약·질문은 읽기를 위한 정리입니다. 원문: ${book.sourceFilename}\n이전 장면의 맥락만 먼저 보여드려요. 다음 장면의 요약은 그 장면을 열었을 때 볼 수 있습니다.`));
    $('main').replaceChildren(wrap);highlightBookmark();renderPhoneNavigation();
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
    if(route.scene){const sec=el('section','dialog-section');sec.append(el('h3','','지금까지의 흐름'),el('p','',route.scene.before));content.append(sec);}
    const memory=el('section','dialog-section');memory.append(el('h3','','다음에 이어 읽을 나에게'));
    memory.append(makeNoteInput(bstate.memory,'작품 전체에서 기억할 맥락',value=>{bstate.memory=value;}));content.append(memory);
    if(route.scene){const sec=el('section','dialog-section');sec.append(el('h3','',`${route.scene.number}장면의 메모`));sec.append(makeNoteInput(currentProgress().note,'방금 이해한 것 · 아직 궁금한 것',value=>{currentProgress().note=value;const inline=$('main').querySelector('textarea');if(inline)inline.value=value;}));content.append(sec);}
    const notes=el('section','dialog-section');notes.append(el('h3','','이전 장면에 남긴 메모'));
    const noted=book.scenes.filter(s=>bstate.scenes[s.number].note&&(!route.scene||s.number<route.scene.number));
    if(!noted.length)notes.append(el('p','no-notes','아직 이전 장면 메모가 없어요. 장면마다 한 줄씩 남겨보세요.'));
    noted.forEach(s=>{const item=el('div','memo-item'),a=link(`${s.number}장면 · ${s.title}`,`#${book.id}/${s.number}`,'memo-link');a.onclick=closeContext;item.append(a,el('p','',bstate.scenes[s.number].note));notes.append(item);});content.append(notes);
    const cast=el('section','dialog-section');cast.append(el('h3','','등장인물 · 기본 관계'));const dl=el('dl','cast-list');book.characters.forEach(([name,desc])=>dl.append(el('dt','',name),el('dd','',desc)));cast.append(dl);content.append(cast);
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
  $('font-down').onclick=()=>changeFont(-1);$('font-up').onclick=()=>changeFont(1);
  function setFontSize(size){const p=capturePosition()||(route.book?currentProgress().positions[state.settings.mode]:null);state.settings.fontSize=Core.bounded(size,16,32,20);applySettings();persist();if(route.book)restorePosition(p);}
  function changeFont(delta){setFontSize(state.settings.fontSize+delta);}
  function toggleTheme(){state.settings.theme=state.settings.theme==='dark'?'paper':'dark';applySettings();persist();}
  $('theme-toggle').onclick=toggleTheme;$('settings-theme').onclick=toggleTheme;
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
