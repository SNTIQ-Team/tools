import assert from 'node:assert/strict';
import test from 'node:test';
import { hookHost } from './testHooks';
import { manualAuthority } from '../data/recipients';
test('draft round-trip preserves manual recipient, attachments and subtype', () => {
  const first = hookHost();
  const { WizardProvider } = first.load<any>('./WizardContext.tsx');
  const render = () => first.render(() => WizardProvider({ children: null })).props.value;
  let wizard = render();
  wizard.openLetter('translation_costs');
  wizard = render();
  assert.equal(typeof wizard.setLetterDraft, 'function', 'editable letter fields belong to snapshot');
  wizard.setLetterDraft((draft: any) => ({ ...draft, manualMode: true, manName: 'Synthetic Office', manAddr: 'Teststr.1\n85049 Ingolstadt',
    manFax: '084100000', pickedRecipient: manualAuthority('Synthetic Office', ['Teststr.1', '85049 Ingolstadt'], '084100000'),
    userAnlagen: 'Anlage1\nAnlage2', subKind: 'asylblg_traeger', ort: 'Ingolstadt' }));
  const snapshot = JSON.parse(JSON.stringify(render().snapshot));
  const second = hookHost();
  const Restored = second.load<any>('./WizardContext.tsx').WizardProvider;
  let restored = second.render(() => Restored({ children: null })).props.value;
  restored.restoreSnapshot(snapshot);
  restored = second.render(() => Restored({ children: null })).props.value;
  assert.equal(restored.letterDraft.manName, 'Synthetic Office');
  assert.equal(restored.letterDraft.pickedRecipient.fax, '084100000');
  assert.equal(restored.letterDraft.userAnlagen, 'Anlage1\nAnlage2');
  assert.equal(restored.letterDraft.subKind, 'asylblg_traeger');
  assert.equal(restored.letterDraft.ort, 'Ingolstadt');
  restored.openLetter('dsgvo_bamf');
  restored = second.render(() => Restored({ children: null })).props.value;
  assert.equal(restored.letterDraft.pickedRecipient, null, 'another letter starts with a fresh recipient');
});

test('draft at triage preserves selected benefit regime before opening a letter', () => {
  const host = hookHost();
  const Provider = host.load<any>('./WizardContext.tsx').WizardProvider;
  const render = () => host.render(() => Provider({ children: null })).props.value;
  render().treeAdvance('synthetic', { choices: { benefitRegime: 'sgb2' } });
  const triage = JSON.parse(JSON.stringify(render().snapshot));
  render().restoreSnapshot(triage);
  render().openLetter('translation_costs');
  assert.equal(render().answers.choices.benefitRegime, 'sgb2');
});
