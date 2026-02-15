import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';

// ---- Context ----
const EventStateContext = createContext(null);

/**
 * Provider: makes a store available to all child components via hooks.
 * The store is created *outside* React. The provider is pure dependency injection.
 *
 * @param {{ store: object, children: React.ReactNode }} props
 */
export function EventStateProvider({ store, children }) {
  return (
    <EventStateContext.Provider value={store}>
      {children}
    </EventStateContext.Provider>
  );
}

/**
 * useStore: returns the EventState store from context.
 * Throws if called outside an EventStateProvider.
 *
 * @returns {object} The EventState store
 */
export function useStore() {
  const store = useContext(EventStateContext);
  if (!store) {
    throw new Error(
      'useStore: no store found. Wrap your component tree in <EventStateProvider store={store}>.'
    );
  }
  return store;
}

/**
 * usePath: subscribe to a dot-path in the store.
 * Re-renders the component only when the value at that path changes.
 * Uses React 18's useSyncExternalStore for concurrent-mode safety.
 *
 * @param {string} path: dot-separated state path (e.g. 'state.tasks')
 * @returns {any} The current value at the path
 */
export function usePath(path) {
  const store = useStore();

  const subscribe = useMemo(
    () => (onStoreChange) => store.subscribe(path, () => onStoreChange()),
    [store, path]
  );

  const getSnapshot = useMemo(
    () => () => store.get(path),
    [store, path]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * useIntent: returns a stable function that publishes a value to a path.
 * Memoized so it won't cause unnecessary re-renders when passed as a prop.
 *
 * @param {string} path: dot-separated intent path (e.g. 'intent.addTask')
 * @returns {(value: any) => any} A setter function
 */
export function useIntent(path) {
  const store = useStore();
  return useMemo(
    () => (value) => store.set(path, value),
    [store, path]
  );
}

/**
 * useWildcard: subscribe to a wildcard path (e.g. 'state.*').
 * Re-renders whenever any child of that path changes.
 * The returned value is the parent object at the path prefix.
 *
 * @param {string} wildcardPath: e.g. 'state.tasks.*' or 'state.*'
 * @returns {any} The current value at the parent path
 */
export function useWildcard(wildcardPath) {
  const store = useStore();
  const parentPath = wildcardPath.endsWith('.*')
    ? wildcardPath.slice(0, -2)
    : wildcardPath;

  const subscribe = useMemo(
    () => (onStoreChange) => store.subscribe(wildcardPath, () => onStoreChange()),
    [store, wildcardPath]
  );

  const getSnapshot = useMemo(
    () => () => store.get(parentPath),
    [store, parentPath]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * useAsync: trigger an async operation and subscribe to its status.
 * Returns { data, status, error, execute, cancel }.
 *
 * @param {string} path: base path for the async operation
 * @returns {{ data: any, status: string, error: any, execute: Function, cancel: Function }}
 */
export function useAsync(path) {
  const store = useStore();

  const data = usePath(`${path}.data`);
  const status = usePath(`${path}.status`);
  const error = usePath(`${path}.error`);

  const execute = useMemo(
    () => (fetcher) => store.setAsync(path, fetcher),
    [store, path]
  );

  const cancel = useMemo(
    () => () => store.cancel(path),
    [store, path]
  );

  return { data, status, error, execute, cancel };
}
