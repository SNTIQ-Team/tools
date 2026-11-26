import assert from 'node:assert/strict';
import test from 'node:test';
import { hookHost, button, nodes } from './testHooks';
import { manualAuthority } from '../data/recipients';
import { remedyFor } from '../data/remedies';

test('restored automatic recipient waits for current resolution; explicit manual recipient survives mount', async () => {
  let wizard: any;
  const host = hookHost(() => wizard);
  const { emptyWizardSnapshot } = host.load<any>('./WizardContext.tsx');
  wizard = { ...emptyWizardSnapshot(), letterId: 'dsgvo_bamf', handFill: true,
    remedy: remedyFor('09'), setLetterDraft: (update: any) => { wizard.letterDraft = update(wizard.letterDraft); } };
  wizard.letterDraft.pickedRecipient = manualAuthority('Saved Office', ['Saved Address'], '0841000');
  const Wizard = host.load<any>('./LetterWizard.tsx').default;
  let tree = host.render(Wizard);
  assert.equal(button(tree, 'letter.previewButton').props.disabled, true, 'saved automatic address needs revalidation');
  host.effects();
  await new Promise<void>(resolve => setImmediate(resolve));
  tree = host.render(Wizard);
  assert.equal(button(tree, 'letter.previewButton').props.disabled, false);
  host.unmount();

  wizard.letterDraft.manualMode = true;
  wizard.letterDraft.pickedRecipient = manualAuthority('Saved Manual Office', ['Saved Address'], '0841000');
  const manual = hookHost(() => wizard);
  const ManualWizard = manual.load<any>('./LetterWizard.tsx').default;
  tree = manual.render(ManualWizard); manual.effects();
  await new Promise<void>(resolve => setImmediate(resolve));
  tree = manual.render(ManualWizard);
  assert.equal(wizard.letterDraft.pickedRecipient.name, 'Saved Manual Office');
  assert.ok(nodes(tree).some(n => n.props?.authority?.fax === '0841000'));
  assert.equal(button(tree, 'letter.previewButton').props.disabled, false);
  manual.unmount();
});

test('manual translation office stays editable and must be reconfirmed when the benefit regime changes or a legacy draft is restored', () => {
  let wizard: any;
  const host = hookHost(() => wizard);
  const { emptyWizardSnapshot } = host.load<any>('./WizardContext.tsx');
  wizard = { ...emptyWizardSnapshot(), letterId: 'translation_costs', handFill: true,
    remedy: remedyFor('12'), setLetterDraft: (update: any) => { wizard.letterDraft = update(wizard.letterDraft); },
    setAnswers: (update: any) => { wizard.answers = update(wizard.answers); } };
  wizard.answers.fields.authorityLetterDate = '2026-11-05';
  wizard.answers.choices.benefitRegime = 'asylblg';
  Object.assign(wizard.letterDraft, { manualMode: true, manName: 'Sozialamt', manAddr: 'Weg 1',
    pickedRecipient: manualAuthority('Sozialamt', ['Weg 1']) });
  const Wizard = host.load<any>('./LetterWizard.tsx').default;
  const render = () => host.render(Wizard);
  const action = (tree: any, key: string) => nodes(tree).find(n => n.type === 'button' && n.props.children === key);
  let tree = render();
  assert.equal(button(tree, 'letter.previewButton').props.disabled, true, 'old draft has no recorded regime confirmation');
  action(tree, 'common.next').props.onClick();
  tree = render();
  assert.equal(button(tree, 'letter.previewButton').props.disabled, false);
  assert.ok(action(tree, 'recipient.edit'));
  nodes(tree).filter(n => n.props?.name === 'benefitRegime')[1].props.onChange();
  tree = render();
  assert.equal(button(tree, 'letter.previewButton').props.disabled, true);
  assert.equal(wizard.letterDraft.manAddr, 'Weg 1', 'preserve the editable draft address');
  nodes(tree).find(n => n.props?.id === 'chamfer-man-name').props.onChange({ target: { value: 'Jobcenter' } });
  action(render(), 'common.next').props.onClick();
  tree = render();
  assert.equal(wizard.letterDraft.pickedRecipient.name, 'Jobcenter');
  assert.equal(wizard.letterDraft.manualBenefitRegime, 'sgb2');
  assert.equal(button(tree, 'letter.previewButton').props.disabled, false);
  action(tree, 'recipient.edit').props.onClick();
  assert.ok(nodes(render()).some(n => n.props?.id === 'chamfer-man-addr'));
  host.unmount();
});
