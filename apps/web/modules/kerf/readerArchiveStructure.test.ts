import assert from 'node:assert/strict';
import test from 'node:test';
import { archiveNorms, archiveTitle, sourceParagraphs } from './readerArchiveStructure';

test('archival inventory comes from that edition including repealed provisions and annexes', () => {
  const markdown = '---\nact_id: test\n---\n\n# Export\n\n> Archive status: exact\n\n## § 1 — Old title\n\n(1) Old text.(2) Another paragraph.\n\n## § 1a — (weggefallen)\n\nRepealed.\n\n## Anlage II — (zu § 1)\n\n1. ab\n2. c\n';
  assert.deepEqual(archiveNorms(markdown), [
    { enbez: '§ 1', titel: 'Old title', text: '(1) Old text.(2) Another paragraph.' },
    { enbez: '§ 1a', titel: '(weggefallen)', text: 'Repealed.' },
    { enbez: 'Anlage II', titel: '(zu § 1)', text: '1. ab\n2. c' },
  ]);
});

test('archive headings support untitled norms, contents, duplicate source headings and nested headings', () => {
  assert.deepEqual(archiveNorms('## Inhaltsübersicht\n\nContents\n\n## Art. 10\n\nA\n\n### Subheading\n\nB\n\n## Art. 10\n\nC'), [
    { enbez: 'Inhaltsübersicht', text: 'Contents' },
    { enbez: 'Art. 10', text: 'A\n\nSubheading\n\nB' },
    { enbez: 'Art. 10', text: 'C' },
  ]);
  assert.deepEqual(archiveNorms('# Just an export title\n\nNo indexed norms.'), []);
  assert.deepEqual(archiveNorms('## § 2 Older title style\n\nText\n\n## Art. 3 · Article title\n\nOther'), [
    { enbez: '§ 2', titel: 'Older title style', text: 'Text' },
    { enbez: 'Art. 3', titel: 'Article title', text: 'Other' },
  ]);
});

test('archival search text decodes Markdown escaping without joining legal list items', () => {
  const markdown = '## § 1 — Formula\\_name\n\n\\[Fe\\(CN\\)6\\]\\_3 and literal\\_underscores\\_here. [§ 2](https://example.test).\n\n3. ab\n4. c\n   - first\n   - second\n';
  const [norm] = archiveNorms(markdown);
  assert.equal(norm.titel, 'Formula_name');
  assert.match(norm.text!, /\[Fe\(CN\)6\]_3 and literal_underscores_here\. § 2\./);
  assert.match(norm.text!, /3\. ab\n4\. c\n/);
  assert.match(norm.text!, /- first\n\s+- second/);
  assert.ok(!norm.text!.includes('abc'));
  assert.ok(!norm.text!.includes('https://example.test'));
  assert.ok(!norm.text!.includes('\\'));
});

test('archival semantic text preserves explicit breaks, code, and quoted text boundaries', () => {
  const [norm] = archiveNorms('## § 1\n\n**A** and _B_ with `x_y`.  \nNext line.\n\n> Quote one.\n>\n> Quote two.\n\n```text\nraw_[x]\n```');
  assert.equal(norm.text, 'A and B with x_y.\nNext line.\n\nQuote one.\n\nQuote two.\n\nraw_[x]');
});

test('paragraph recovery retains every character while splitting consecutive legal Absatz markers', () => {
  for (const text of [
    '(1) First.(2) Second.(2a) Inserted.(3) Last.',
    '  (1) First.  (1a) Inserted.\n(1b) More.\n\n(2) Last.  ',
    '(3) First in a partial excerpt.(4) Next.',
    '(1) First on its own line\n(2) Another line\n(3) Last line',
  ]) {
    const paragraphs = sourceParagraphs(text);
    assert.ok(paragraphs.length > 1, text);
    assert.equal(paragraphs.join(''), text);
  }
});

test('paragraph recovery refuses ambiguous embedded numbers, nonsequential markers and absent opening markers', () => {
  for (const text of [
    'A reference to (1) and (2).',
    '(1) Die Werte (2) und (3) werden addiert.',
    '(1) Value.(3) Not a proven next paragraph.',
    '(1) A quotation: "(2) text".',
    '(1) Absatz (2) wird entsprechend angewendet.',
    '(1) Value.(2a) Missing paragraph two.',
    '1Das ist ein Satz. 2Noch ein Satz.',
    '',
  ]) assert.deepEqual(sourceParagraphs(text), [text]);
});

test('paragraph splitting does not duplicate, drop, or reorder source spaces', () => {
  const text = '(1) Test.\u00a0\u00a0(2) Zweiter Test.\r\n(3) Ende.';
  assert.equal(sourceParagraphs(text).length, 3);
  assert.equal(sourceParagraphs(text).join(''), text);
});

test('Bavarian sentence recovery is opt-in and retains explicit consecutive attached ordinals', () => {
  const text = '1Das Verwaltungsverfahren ist an bestimmte Formen nicht gebunden. 2Es ist einfach, zweckmäßig und zügig durchzuführen.';
  assert.deepEqual(sourceParagraphs(text), [text]);
  assert.deepEqual(sourceParagraphs(text, { bavarianSentences: true }), [
    '1Das Verwaltungsverfahren ist an bestimmte Formen nicht gebunden. ',
    '2Es ist einfach, zweckmäßig und zügig durchzuführen.',
  ]);
  const withParagraphs = '(1) 1Das gilt. 2Dies auch.(2) 1Noch mehr. 2Und weiter.';
  const chunks = sourceParagraphs(withParagraphs, { bavarianSentences: true });
  assert.equal(chunks.length, 4);
  assert.equal(chunks.join(''), withParagraphs);
});

test('Bavarian recovery does not interpret doses, CO2, dates, citations or detached numbers as sentences', () => {
  for (const text of [
    '10 mg werden genommen. 20 mg folgen.',
    'CO2 ist ein Gas. 2Es folgt.',
    '1 CO2 ist erlaubt. 2 Mg sind erlaubt.',
    '1A ist ein Feld. 2B ist ein anderes.',
    '1Das gilt nach § 2. 3Das fehlt.',
    'Nach § 1Das ist kein Satz. 2Dies ebenso.',
    '1. Januar 2026. 2. Februar 2026.',
    '(1) Bezug auf Art. 2Dies ist ein Zitat.',
  ]) assert.deepEqual(sourceParagraphs(text, { bavarianSentences: true }), [text]);
});


test('historical document titles use the selected export title and remove only the exact norm suffix', () => {
  assert.equal(archiveTitle('---\nact_id: old\n---\n\n# Old law title\n\n## § 1\n\nBody'), 'Old law title');
  assert.equal(archiveTitle('# Old law title — § 79\n\n## § 79', '§ 79'), 'Old law title');
  assert.equal(archiveTitle('# Old law title — § 790', '§ 79'), 'Old law title — § 790');
  assert.equal(archiveTitle('# Old law title — § 79'), 'Old law title — § 79');
  assert.equal(archiveTitle(String.raw`# Old \[name\] and title\_part **emphasis** — § 79`, '§ 79'), 'Old [name] and title_part emphasis');
  assert.equal(archiveTitle('## § 79\n\n# Heading inside the body'), undefined);
  assert.equal(archiveTitle('Ordinary source text\n\n# Later heading'), undefined);
  assert.equal(archiveTitle(''), undefined);
});
