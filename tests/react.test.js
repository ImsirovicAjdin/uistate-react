/**
 * @uistate/react: integration tests via @uistate/event-test
 *
 * Tests the store-side patterns that React hooks consume.
 * Since EventState is the IR, testing the IR proves the hooks work.
 * The hooks are thin wrappers: usePath = subscribe + get,
 * useIntent = set, useWildcard = subscribe wildcard + get parent.
 *
 * JSX/React-specific behavior (re-renders, concurrent mode) requires
 * a React test environment and is outside the scope of these tests.
 */

import { createEventTest, runTests } from '@uistate/event-test';
import { createEventState } from '@uistate/core';

const results = runTests({

  // -- usePath patterns ----------------------------------------------

  'usePath: subscribe to exact path': () => {
    const t = createEventTest({ user: { name: 'Alice', age: 30 } });
    t.trigger('user.name', 'Bob');
    t.assertPath('user.name', 'Bob');
    t.assertType('user.name', 'string');
    t.assertEventFired('user.name', 1);
  },

  'usePath: nested path subscription': () => {
    const t = createEventTest({ app: { settings: { theme: 'dark' } } });
    t.trigger('app.settings.theme', 'light');
    t.assertPath('app.settings.theme', 'light');
    t.assertEventFired('app.settings.theme', 1);
  },

  'usePath: unsubscribe stops notifications': () => {
    const store = createEventState({ count: 0 });
    let fires = 0;
    const unsub = store.subscribe('count', () => { fires++; });
    store.set('count', 1);
    unsub();
    store.set('count', 2);
    if (fires !== 1) throw new Error(`Expected 1 fire after unsub, got ${fires}`);
    store.destroy();
  },

  // -- useIntent patterns --------------------------------------------

  'useIntent: set value at path': () => {
    const t = createEventTest({ intent: { addTask: null } });
    t.trigger('intent.addTask', { text: 'Buy milk', done: false });
    t.assertPath('intent.addTask', { text: 'Buy milk', done: false });
    t.assertType('intent.addTask', 'object');
  },

  'useIntent: reset intent after processing': () => {
    const t = createEventTest({ intent: { submit: null } });
    t.trigger('intent.submit', { form: 'login' });
    t.trigger('intent.submit', null);
    t.assertPath('intent.submit', null);
  },

  // -- useWildcard patterns ------------------------------------------

  'useWildcard: fires on any child change': () => {
    const store = createEventState({ state: { tasks: {} } });
    let fires = 0;
    store.subscribe('state.tasks.*', () => { fires++; });
    store.set('state.tasks.t1', { text: 'A', done: false });
    store.set('state.tasks.t2', { text: 'B', done: false });
    if (fires !== 2) throw new Error(`Expected 2 fires, got ${fires}`);
    store.destroy();
  },

  'useWildcard: get parent returns full object': () => {
    const t = createEventTest({ state: { tasks: { t1: 'A', t2: 'B' } } });
    t.trigger('state.tasks.t3', 'C');
    t.assertPath('state.tasks', { t1: 'A', t2: 'B', t3: 'C' });
  },

  // -- useAsync patterns ---------------------------------------------

  'useAsync: loading → success lifecycle': async () => {
    const store = createEventState({});
    await store.setAsync('users', async () => [{ id: 1, name: 'Alice' }]);
    if (store.get('users.status') !== 'success') throw new Error('Expected success');
    if (!Array.isArray(store.get('users.data'))) throw new Error('Expected array');
    store.destroy();
  },

  'useAsync: loading → error lifecycle': async () => {
    const store = createEventState({});
    try {
      await store.setAsync('data', async () => { throw new Error('fail'); });
    } catch {}
    if (store.get('data.status') !== 'error') throw new Error('Expected error');
    store.destroy();
  },

  'useAsync: status/data/error paths are typed': () => {
    const t = createEventTest({});
    t.store.setMany({
      'users.status': 'success',
      'users.data': [{ id: 1, name: 'Alice' }],
      'users.error': null,
    });
    t.assertType('users.status', 'string');
    t.assertArrayOf('users.data', { id: 'number', name: 'string' });
  },

  // -- Provider pattern ----------------------------------------------

  'provider: store as external store (useSyncExternalStore compat)': () => {
    const store = createEventState({ count: 0 });
    // Simulate useSyncExternalStore contract
    let snapshot = store.get('count');
    const subscribe = (cb) => store.subscribe('count', () => {
      snapshot = store.get('count');
      cb();
    });
    let renderCount = 0;
    const unsub = subscribe(() => { renderCount++; });

    store.set('count', 1);
    if (snapshot !== 1) throw new Error('Snapshot should be 1');
    if (renderCount !== 1) throw new Error('Should have rendered once');

    store.set('count', 2);
    if (snapshot !== 2) throw new Error('Snapshot should be 2');
    if (renderCount !== 2) throw new Error('Should have rendered twice');

    unsub();
    store.destroy();
  },

  // -- batch (React 18 automatic batching compat) --------------------

  'batch: atomic updates (React 18 compat)': () => {
    const t = createEventTest({ form: { name: '', email: '' } });
    t.store.batch(() => {
      t.trigger('form.name', 'Alice');
      t.trigger('form.email', 'alice@example.com');
    });
    t.assertPath('form.name', 'Alice');
    t.assertPath('form.email', 'alice@example.com');
    // Each path fires once after batch
    t.assertEventFired('form.name', 1);
    t.assertEventFired('form.email', 1);
  },

  'batch: setMany for atomic route updates': () => {
    const t = createEventTest({});
    t.store.setMany({
      'ui.route.view': 'dashboard',
      'ui.route.path': '/dashboard',
      'ui.route.params': {},
    });
    t.assertPath('ui.route.view', 'dashboard');
    t.assertPath('ui.route.path', '/dashboard');
    t.assertType('ui.route.view', 'string');
  },

  // -- type generation from React patterns ---------------------------

  'types: React app state shape': () => {
    const t = createEventTest({
      user: { name: 'Alice', email: 'alice@example.com', role: 'admin' },
      tasks: [{ id: 1, text: 'Buy milk', done: false }],
      ui: { theme: 'dark', sidebarOpen: true },
    });
    t.assertShape('user', { name: 'string', email: 'string', role: 'string' });
    t.assertArrayOf('tasks', { id: 'number', text: 'string', done: 'boolean' });
    t.assertShape('ui', { theme: 'string', sidebarOpen: 'boolean' });

    const types = t.getTypeAssertions();
    if (types.length !== 3) throw new Error(`Expected 3 type assertions, got ${types.length}`);
  },
});

if (results.failed > 0) process.exit(1);
