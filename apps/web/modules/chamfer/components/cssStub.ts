// Test-only helper. Node cannot parse CSS, and the components now take their
// classes from chamfer.module.css — so under `node --test` every CSS module
// resolves to an object that maps each class to its own name (s.stage → "stage").
// Imported by testHooks.ts and, first, by the tests that render components
// directly. Never imported by the app.
import Module from 'node:module';

const classNames = new Proxy({}, {
  get: (_target, key) => (typeof key === 'string' && key !== '__esModule' ? key : undefined),
});

(Module as unknown as { _extensions: Record<string, (module: { exports: unknown }) => void> })
  ._extensions['.css'] = (module) => { module.exports = classNames; };
