"""Build static reading data, preserving every extracted source paragraph."""
from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parent
SOURCES = ROOT.parent / '작업파일'
SPEAKERS = r'임공우|입공우|강정옥|강정욱|강경옥|강정우|고상오|고장오|김갑원|김감원|김갑천|박승조|성현기|성전기|오한구|최철민|최철미|김수정|신\s?반장|신팀장|장\s?형사|수정,\s?철민'


def build():
    editorial = json.loads((ROOT / 'editorial.json').read_text(encoding='utf-8'))
    books = []
    for book_id, filename, expected_count in [
        ('sidong', '시동라사 원본.txt', 16),
        ('temp', '18학번 템프파일.txt', 6),
    ]:
        original = (SOURCES / filename).read_text(encoding='utf-8')
        lines = original.splitlines()
        pattern = r'^\d+$' if book_id == 'sidong' else r'^\d+\.\s'
        starts = [i for i, text in enumerate(lines) if re.match(pattern, text)]
        assert len(starts) == expected_count
        info = editorial[book_id]
        assert len(info['scenes']) == expected_count

        def pack_line(i):
            text = lines[i]
            match = re.match(r'^(' + SPEAKERS + r')(\s*[:：]\s*|\t+|\s+)(.*)$', text)
            return {'number': i + 1, 'text': text, **(
                {'speaker': match[1], 'body': match[3]} if match else {})}

        intro = [pack_line(i) for i in range(starts[0])]
        scenes = []
        for index, start in enumerate(starts):
            end = starts[index + 1] if index + 1 < len(starts) else len(lines)
            assert int(re.match(r'\d+', lines[start])[0]) == index + 1
            scene = {**info['scenes'][index], 'number': index + 1,
                     'heading': lines[start], 'lines': [pack_line(i) for i in range(start + 1, end)]}
            scene['chars'] = sum(len(line['text']) for line in scene['lines'])
            scenes.append(scene)
        rebuilt = [line['text'] for line in intro]
        for scene in scenes:
            rebuilt += [scene['heading']] + [line['text'] for line in scene['lines']]
        assert rebuilt == lines, f'Source coverage failed: {book_id}'
        assert '\ufffd' not in original
        books.append({**info, 'id': book_id, 'scenes': scenes, 'intro': intro,
                      'sourceFilename': filename.replace('.txt', '.hwp'),
                      'sourceHash': hashlib.sha256(original.encode('utf-8')).hexdigest(),
                      'chars': len(original)})
    target = ROOT / 'dist' / 'data.js'
    target.parent.mkdir(exist_ok=True)
    target.write_text('window.READING_BOOKS = ' + json.dumps(books, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    print(json.dumps({'books': len(books), 'scenes': sum(len(b['scenes']) for b in books),
                      'source_paragraphs': sum(len(b['intro']) + sum(1 + len(s['lines']) for s in b['scenes']) for b in books),
                      'source_coverage': 'exact', 'output_bytes': target.stat().st_size}, ensure_ascii=False))


if __name__ == '__main__':
    build()
