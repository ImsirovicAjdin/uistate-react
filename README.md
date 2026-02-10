# @uistate/react

React adapter for [@uistate/core](https://www.npmjs.com/package/@uistate/core). Five hooks and a provider — that's the entire API.

## Install

```bash
npm install @uistate/react @uistate/core react
```

**Peer dependencies:** `@uistate/core >=5.0.0` and `react >=18.0.0`.

## Quick Start

```jsx
import { createEventState } from '@uistate/core';
import { EventStateProvider, usePath, useIntent } from '@uistate/react';

// Store lives outside React
const store = createEventState({
  state: { count: 0 },
});

// Business logic lives outside React
store.subscribe('intent.increment', () => {
  store.set('state.count', store.get('state.count') + 1);
});

function Counter() {
  const count = usePath('state.count');
  const increment = useIntent('intent.increment');
  return <button onClick={() => increment(true)}>Count: {count}</button>;
}

function App() {
  return (
    <EventStateProvider store={store}>
      <Counter />
    </EventStateProvider>
  );
}
```

## API

### `<EventStateProvider store={store}>`

Makes a store available to all descendant hooks via React Context. The store is created outside React — the provider is pure dependency injection, not a state container.

```jsx
<EventStateProvider store={store}>
  <App />
</EventStateProvider>
```

### `useStore()`

Returns the store from context. Throws if called outside a provider.

```jsx
const store = useStore();
```

### `usePath(path)`

Subscribe to a dot-path. Re-renders only when the value at that path changes. Uses `useSyncExternalStore` for concurrent-mode safety.

```jsx
const tasks = usePath('state.tasks');
const userName = usePath('state.user.name');
const filtered = usePath('derived.tasks.filtered');
```

### `useIntent(path)`

Returns a stable, memoized function that publishes a value to a path. Safe to pass as a prop without causing re-renders.

```jsx
const addTask = useIntent('intent.addTask');
const setFilter = useIntent('intent.changeFilter');

// In a handler:
addTask('Buy milk');
setFilter('active');
```

### `useWildcard(path)`

Subscribe to a wildcard path. Re-renders when any child of that path changes. Returns the parent object.

```jsx
const user = useWildcard('state.user.*');
// Re-renders when state.user.name, state.user.email, etc. change
```

### `useAsync(path)`

Async data fetching with automatic status tracking. Returns `{ data, status, error, execute, cancel }`.

```jsx
function UserList() {
  const { data, status, error, execute, cancel } = useAsync('users');

  useEffect(() => {
    execute((signal) =>
      fetch('/api/users', { signal }).then(r => r.json())
    );
  }, [execute]);

  if (status === 'loading') return <Spinner />;
  if (error) return <Error message={error} />;
  return <ul>{data?.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

Calling `execute` again auto-aborts the previous in-flight request. No race conditions.

## Architecture

The recommended pattern is three namespaces:

| Namespace | Purpose | Hooks |
|-----------|---------|-------|
| `state.*` | Authoritative application state | `usePath` |
| `derived.*` | Computed projections | `usePath` |
| `intent.*` | Write-only signals from the UI | `useIntent` |

This gives you Model-View-Intent (MVI) inside a single store:

- **state.\*** is the Model
- **derived.\*** is the ViewModel
- **intent.\*** is the Controller

```jsx
// Component only declares what it reads and what it publishes
function Filters() {
  const filter = usePath('state.filter');           // read
  const setFilter = useIntent('intent.changeFilter'); // write
  return <button onClick={() => setFilter('active')}>{filter}</button>;
}
```

Business logic lives in subscribers — testable without React:

```js
store.subscribe('intent.addTask', (text) => {
  const tasks = store.get('state.tasks') || [];
  store.set('state.tasks', [...tasks, { id: genId(), text }]);
});
```

## Why a separate package?

- **Zero cost if you don't use React** — `@uistate/core` stays framework-free
- **React is a peer dependency** — not bundled, no version conflicts
- **Tiny** — ~50 lines of code, no dependencies beyond React and the core store

## License

MIT
