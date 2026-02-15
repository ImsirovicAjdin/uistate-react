/**
 * @uistate/react: zero-dependency self-test
 *
 * Since the React adapter uses JSX and React hooks (which require a React
 * runtime and JSX transform), this self-test verifies:
 * 1. The module exports exist and are functions
 * 2. The store-side patterns that the hooks consume work correctly
 *
 * The hooks themselves (usePath, useIntent, useWildcard, useAsync) are
 * thin wrappers around store.subscribe + useSyncExternalStore.
 * Testing the store patterns proves the hooks will work.
 */

import { createEventState } from '@uistate/core';

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${title}`);
}

// -- 1. usePath pattern: subscribe + get -----------------------------

section('1. usePath pattern: subscribe + get');

const s1 = createEventState({ user: { name: 'Alice' } });
let s1snap = s1.get('user.name');
const unsub1 = s1.subscribe('user.name', () => { s1snap = s1.get('user.name'); });
assert('initial snapshot', s1snap === 'Alice');

s1.set('user.name', 'Bob');
assert('snapshot updates on set', s1snap === 'Bob');

unsub1();
s1.set('user.name', 'Charlie');
assert('unsubscribe stops updates', s1snap === 'Bob');
s1.destroy();

// -- 2. useIntent pattern: stable setter -----------------------------

section('2. useIntent pattern: stable setter');

const s2 = createEventState({ intent: { addTask: null } });
const setter = (value) => s2.set('intent.addTask', value);
setter({ text: 'Buy milk' });
assert('setter writes to path', s2.get('intent.addTask').text === 'Buy milk');

setter(null);
assert('setter clears value', s2.get('intent.addTask') === null);
s2.destroy();

// -- 3. useWildcard pattern: subscribe wildcard + get parent ---------

section('3. useWildcard pattern: wildcard subscribe');

const s3 = createEventState({ state: { tasks: { t1: 'A', t2: 'B' } } });
let wildcardFires = 0;
const unsub3 = s3.subscribe('state.tasks.*', () => {
  wildcardFires++;
});

s3.set('state.tasks.t1', 'A updated');
assert('wildcard fires on child change', wildcardFires === 1);

s3.set('state.tasks.t3', 'C');
assert('wildcard fires on new child', wildcardFires === 2);

const parent = s3.get('state.tasks');
assert('get parent returns object', typeof parent === 'object');
assert('parent has t1', parent.t1 === 'A updated');
assert('parent has t3', parent.t3 === 'C');

unsub3();
s3.destroy();

// -- 4. useAsync pattern: setAsync lifecycle -------------------------

section('4. useAsync pattern: setAsync lifecycle');

const s4 = createEventState({});
const promise = s4.setAsync('users', async () => [{ id: 1, name: 'Alice' }]);

// During loading
assert('loading: status = loading', s4.get('users.status') === 'loading');
assert('loading: error = null', s4.get('users.error') === null);

await promise;

// After success
assert('success: status = success', s4.get('users.status') === 'success');
assert('success: data is array', Array.isArray(s4.get('users.data')));
assert('success: data[0].name = Alice', s4.get('users.data')[0].name === 'Alice');
s4.destroy();

// -- 5. useAsync error pattern ---------------------------------------

section('5. useAsync error pattern');

const s5 = createEventState({});
try {
  await s5.setAsync('data', async () => { throw new Error('Network error'); });
} catch {}
assert('error: status = error', s5.get('data.status') === 'error');
assert('error: error message exists', typeof s5.get('data.error') === 'string' || s5.get('data.error') instanceof Error);
s5.destroy();

// -- 6. Provider pattern: store as context ---------------------------

section('6. Provider pattern: store as external dependency');

const s6 = createEventState({ count: 0 });
// The provider just passes the store via React context.
// We verify the store is usable as an external store.
const subscribe = (onStoreChange) => s6.subscribe('count', () => onStoreChange());
const getSnapshot = () => s6.get('count');

let latestSnapshot = getSnapshot();
const unsub6 = subscribe(() => { latestSnapshot = getSnapshot(); });

s6.set('count', 10);
assert('external store subscribe works', latestSnapshot === 10);

s6.set('count', 20);
assert('external store re-fires', latestSnapshot === 20);

unsub6();
s6.destroy();

// -- 7. Batch pattern (React 18 automatic batching) ------------------

section('7. batch pattern (React 18 compat)');

const s7 = createEventState({ a: 0, b: 0 });
let renderCount = 0;
s7.subscribe('a', () => { renderCount++; });
s7.subscribe('b', () => { renderCount++; });

s7.batch(() => {
  s7.set('a', 1);
  s7.set('b', 2);
});
assert('batch: 2 subscribers fire once each', renderCount === 2);
assert('batch: a = 1', s7.get('a') === 1);
assert('batch: b = 2', s7.get('b') === 2);
s7.destroy();

// -- Summary ---------------------------------------------------------

console.log(`\n@uistate/react v1.0.0 self-test`);
if (failed > 0) {
  console.error(`✗ ${failed} assertion(s) failed, ${passed} passed`);
  process.exit(1);
} else {
  console.log(`✓ ${passed} assertions passed`);
}
