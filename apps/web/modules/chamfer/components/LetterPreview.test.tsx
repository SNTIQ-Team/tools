import assert from 'node:assert/strict';
import test from 'node:test';
import { hookHost, nodes, button } from './testHooks';
import { letterById } from '../data/letters';
import { manualAuthority } from '../data/recipients';
import { emptyAnswers } from '../engine/logic';
import { remedyFor } from '../data/remedies';
test('PDF and DOCX failures are visible and both download buttons remain retryable', async () => {
  const original = globalThis.fetch;
  const host = hookHost(() => ({ answers: emptyAnswers(), profile: { name: 'Test', surname: 'Audit', dob: '', street: '', plzCity: '' }, remedy: remedyFor('09'), handFill: true, coApplicants: [], letterDraft: { faxLine: true }, setLetterDraft() {} }));
  const Preview = host.load<{ default: (props: any) => any }>('./LetterPreview.tsx').default;
  const props = { letter: letterById('dsgvo_bamf'), recipient: manualAuthority('Synthetic', ['Synthetic'], '') };
  assert.ok(props.letter);
  try {
    globalThis.fetch = async () => new Response('', { status: 503 });
    for (const key of ['common.downloadPdf', 'common.downloadDocx']) {
      let tree = host.render(() => Preview(props));
      await button(tree, key).props.onClick();
      tree = host.render(() => Preview(props));
      assert.ok(button(tree, key), key + ' still available for retry');
      assert.equal(button(tree, key).props.disabled, false);
      assert.ok(nodes(tree).some(n => n.props?.role === 'alert'), 'download failure is announced');
    }
  } finally { host.unmount(); globalThis.fetch = original; }
});
