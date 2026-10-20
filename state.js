(function (root) {
  'use strict';
  const position = () => ({ line: null, delta: 0, top: 0, percent: 0 });
  const scene = () => ({ done: false, summaryDone: false, summaryOpen: true, visited: false, note: '', positions: { summary: position(), full: position() }, bookmark: null });
  const bounded = (value, min, max, fallback) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  function fresh(books) {
    return { version: 1, settings: { fontSize: 18, theme: 'paper', mode: 'full', characterColors: true }, last: null,
      books: Object.fromEntries(books.map(b => [b.id, { sourceHash: b.sourceHash, lastScene: 1, memory: '', scenes: Object.fromEntries(b.scenes.map(s => [s.number, scene()])) }])) };
  }
  function normalize(raw, books, strict = false) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) {
      if (strict) throw new Error('이 독서실에서 내보낸 진도 파일을 선택해 주세요.');
      return fresh(books);
    }
    const out = fresh(books);
    out.settings.fontSize = Math.round(bounded(raw.settings?.fontSize, 12, 32, 18));
    out.settings.theme = raw.settings?.theme === 'dark' ? 'dark' : 'paper';
    out.settings.mode = 'full'; // Legacy backup field; the original is now always visible.
    out.settings.characterColors = raw.settings?.characterColors !== false;
    for (const book of books) {
      const source = raw.books?.[book.id];
      if (!source || source.sourceHash !== book.sourceHash) {
        if (strict) throw new Error('대본 원문 버전이 다른 진도 파일입니다. 현재 기록은 그대로 두었습니다.');
        continue;
      }
      const target = out.books[book.id];
      target.lastScene = Math.round(bounded(source.lastScene, 1, book.scenes.length, 1));
      target.memory = typeof source.memory === 'string' ? source.memory.slice(0, 16000) : '';
      for (const s of book.scenes) {
        const from = source.scenes?.[s.number];
        if (!from || typeof from !== 'object') continue;
        const to = target.scenes[s.number];
        for (const flag of ['done', 'summaryDone', 'visited']) to[flag] = from[flag] === true;
        to.summaryOpen = from.summaryOpen !== false;
        to.note = typeof from.note === 'string' ? from.note.slice(0, 16000) : '';
        const allowed = new Set(s.lines.map(l => l.number));
        for (const mode of ['summary', 'full']) {
          const p = from.positions?.[mode];
          if (!p || typeof p !== 'object') continue;
          to.positions[mode] = { line: allowed.has(p.line) ? p.line : null,
            delta: bounded(p.delta, -5000, 5000, 0), top: bounded(p.top, 0, 1000000, 0), percent: bounded(p.percent, 0, 100, 0) };
        }
        if (from.bookmark && allowed.has(from.bookmark.line)) to.bookmark = { line: from.bookmark.line, delta: bounded(from.bookmark.delta, -5000, 5000, 0), top: bounded(from.bookmark.top, 0, 1000000, 0), percent: bounded(from.bookmark.percent, 0, 100, 0) };
      }
    }
    if (books.some(b => b.id === raw.last?.bookId && b.scenes.some(s => s.number === raw.last?.scene))) out.last = { bookId: raw.last.bookId, scene: raw.last.scene };
    return out;
  }
  function progress(book, state) {
    const rows = Object.values(state.books[book.id].scenes);
    return { total: book.scenes.length, full: rows.filter(s => s.done).length, summary: rows.filter(s => s.summaryDone).length };
  }
  function parseRoute(hash, books) {
    const parts = hash.replace(/^#/, '').split('/');
    const book = books.find(b => b.id === parts[0]);
    if (!book) return { book: null, scene: null };
    const number = Number(parts[1]);
    const s = book.scenes.find(s => s.number === number);
    return s ? { book, scene: s } : { book: null, scene: null };
  }
  const api = { fresh, normalize, progress, parseRoute, bounded };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReaderState = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
