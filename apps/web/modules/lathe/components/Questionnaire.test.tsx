import assert from 'node:assert/strict';
import test from 'node:test';
import { hookHost, nodes } from '../../chamfer/components/testHooks';
import { INITIAL_DATA } from '../wizard';
import { IncomeType, type LatheFormData } from '../types';

// Next on an incomplete step: navigation stays blocked exactly as before,
// but the press is no longer swallowed by a disabled button — it turns the
// step's required-field errors on.
test('Next on an incomplete step does not advance and reveals what is missing; a complete step advances', () => {
  let state: LatheFormData = structuredClone(INITIAL_DATA);
  const host = hookHost(() => ({ state, dispatch() {} }));
  const Questionnaire = host.load<any>('../../lathe/components/Questionnaire.tsx').default;
  const view = () => {
    const all = nodes(host.render(Questionnaire));
    return {
      step: all.find(n => n.props?.step && 'attempted' in n.props)!.props,
      next: all.find(n => n.type === 'button' && String(n.props.className).includes('lathe-next'))!.props,
    };
  };
  try {
    let v = view();
    assert.equal(v.step.step.id, 'intro');
    assert.equal(v.step.attempted, false, 'nothing is flagged before the user acts');
    assert.equal(v.step.touched.size, 0);
    assert.ok(!v.next.disabled, 'Next can be pressed');

    v.next.onClick();
    v = view();
    assert.equal(v.step.step.id, 'intro', 'still blocked');
    assert.equal(v.step.attempted, true, 'the blocked attempt shows the errors');

    v.step.onTouch('courtInfo');
    assert.ok(view().step.touched.has('courtInfo'));

    state = structuredClone(INITIAL_DATA);
    state.personal.courtInfo = 'SG Muenchen';
    state.incomeType = IncomeType.OTHER;
    v = view();
    v.next.onClick();
    v = view();
    assert.notEqual(v.step.step.id, 'intro', 'a valid step advances');
    assert.equal(v.step.attempted, false, 'the next step starts clean');
  } finally { host.unmount(); }
});

// A parent that passes a new callback on every render must not be called
// again and again for the same step (that fed a render loop in LatheModule).
test('the step is reported once per change, not on every render of the parent', () => {
  const state: LatheFormData = structuredClone(INITIAL_DATA);
  const host = hookHost(() => ({ state, dispatch() {} }));
  const Questionnaire = host.load<any>('../../lathe/components/Questionnaire.tsx').default;
  const calls: string[] = [];
  try {
    for (let i = 0; i < 5; i++) {
      host.render(() => Questionnaire({ onStepChange: (_: number, id: string) => calls.push(id) }));
      host.effects();
    }
    assert.deepEqual(calls, ['intro']);
  } finally { host.unmount(); }
});
