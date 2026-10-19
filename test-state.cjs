const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Core = require('./dist/state.js');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(__dirname + '/dist/data.js', 'utf8'), sandbox);
const books = JSON.parse(JSON.stringify(sandbox.window.READING_BOOKS));

test('both scripts contain every numbered scene and nonempty teaching content', () => {
  assert.deepEqual(books.map(b => b.scenes.length), [16, 6]);
  for (const b of books) for (const [i,s] of b.scenes.entries()) {
    assert.equal(s.number, i + 1); assert.equal(s.summary.length, 2);
    assert.equal(s.focus.length, 2); assert.ok(s.before && s.question && s.lines.length);
  }
});
test('summary and original completion remain distinct through a reload', () => {
  const s = Core.fresh(books); s.books.sidong.scenes[1].summaryDone = true;
  const r = Core.normalize(JSON.parse(JSON.stringify(s)), books, true);
  assert.deepEqual(Core.progress(books[0],r), {total:16, full:0, summary:1});
});
test('notes, memory, last scene and both reading positions round-trip', () => {
  const s = Core.fresh(books); s.last = {bookId:'temp',scene:4}; s.books.temp.lastScene=4;
  const p=s.books.temp.scenes[4];p.note='기억을 피하는 태도';p.positions.full={line:600,delta:-12,top:3450,percent:45};p.positions.summary.top=400;
  s.books.temp.memory='학생과 목격자의 관계';s.settings.fontSize=27;s.settings.mode='full';
  const r=Core.normalize(JSON.parse(JSON.stringify(s)),books,true);
  assert.deepEqual(r,s);
});
test('one scene progress cannot mark other scenes or the other book read', () => {
  const s=Core.fresh(books);s.books.sidong.scenes[16].done=true;
  assert.equal(Core.progress(books[0],s).full,1);assert.equal(Core.progress(books[1],s).full,0);
});
test('font size and untrusted scroll values are clamped', () => {
  const s=Core.fresh(books);s.settings.fontSize=200;s.books.sidong.scenes[1].positions.full={line:999999,top:Infinity,delta:-Infinity,percent:500};
  const r=Core.normalize(s,books,true);assert.equal(r.settings.fontSize,32);
  assert.deepEqual(r.books.sidong.scenes[1].positions.full,{line:null,top:0,delta:0,percent:100});
});
test('imports from another source revision are rejected without mutating current progress', () => {
  const current=Core.fresh(books);current.books.sidong.scenes[1].note='보존할 메모';
  const incoming=Core.fresh(books);incoming.books.sidong.sourceHash='different-source';
  assert.throws(()=>Core.normalize(incoming,books,true),/원문 버전/);assert.equal(current.books.sidong.scenes[1].note,'보존할 메모');
});
test('new source content does not inherit old read certifications', () => {
  const old=Core.fresh(books);old.books.temp.scenes[1].done=true;
  old.books.temp.sourceHash='old-content';
  assert.equal(Core.normalize(old,books).books.temp.scenes[1].done,false);
});
test('unknown state keys, wrong flag types and unsafe routes are not trusted', () => {
  const s=Core.fresh(books);s.books.sidong.scenes[1].done='true';s.last={bookId:'sidong',scene:900};
  s.books.unknown={sourceHash:'x'};const r=Core.normalize(s,books,true);
  assert.equal(r.books.sidong.scenes[1].done,false);assert.equal(r.last,null);assert.equal(r.books.unknown,undefined);
  assert.equal(Core.parseRoute('#sidong/900',books).book,null);assert.equal(Core.parseRoute('#temp/6',books).scene.number,6);
});
test('invalid backup shapes are rejected', () => {
  for(const invalid of [null,[],{}, {version:2},'text'])assert.throws(()=>Core.normalize(invalid,books,true));
});
test('bookmarks refer only to paragraphs belonging to their own scene', () => {
  const s=Core.fresh(books);s.books.sidong.scenes[1].bookmark={line:1000};s.books.sidong.scenes[2].bookmark={line:150,delta:4,top:600,percent:20};
  const r=Core.normalize(s,books,true);assert.equal(r.books.sidong.scenes[1].bookmark,null);assert.equal(r.books.sidong.scenes[2].bookmark.line,150);
});
