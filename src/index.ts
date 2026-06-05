export type StateShape = Record<string, unknown>;

/** A new value, or a functional updater that derives it from the previous one. */
export type SetterArg<Value> = Value | ((previous: Value) => Value);

/**
 * The `set`-prefixed key for a given state key, e.g. `age` -> `setAge`.
 * Non-string keys (symbols / numbers) are dropped.
 */
type SetterKey<Key extends PropertyKey> = Key extends string
  ? `set${Capitalize<Key>}`
  : never;

/**
 * One always-present updater per key of `T`. Each setter accepts either a new
 * value or a functional updater `(previous) => next`.
 */
export type Updater<T> = {
  [Key in keyof T as SetterKey<Key>]-?: (value: SetterArg<T[Key]>) => void;
};

/** A single committed state change, discriminated by `key`. */
export type Change<T> = {
  [Key in keyof T]-?: {
    readonly key: Key;
    readonly previous: T[Key];
    readonly value: T[Key];
  };
}[keyof T];

/** Notified after every change that actually updates the state. */
export type Listener<T> = (state: Readonly<T>, change: Change<T>) => void;

/**
 * The primitives handed to an extension: everything needed to read, write and
 * observe the store, and nothing else. Build whatever you like on top.
 */
export interface StoreContext<T> {
  /** The live state, typed read-only (write through `set`). */
  readonly state: Readonly<T>;
  /** Update a single key with a value or a functional updater. */
  set<Key extends keyof T>(key: Key, value: SetterArg<T[Key]>): void;
  /** Subscribe to changes; returns an unsubscribe function. */
  subscribe(listener: Listener<T>): () => void;
}

/** A plugin: receives the store primitives, returns extra members to merge in. */
export type Extension<T, E> = (context: StoreContext<T>) => E;

interface StoreCore<T> {
  /** The live state object. */
  state: T;
  /** Subscribe to changes; returns an unsubscribe function. */
  subscribe(listener: Listener<T>): () => void;
  /**
   * Extend the store with custom members built on the core primitives.
   * Chainable: each call's members are inferred independently and accumulate.
   */
  with<E extends object>(extend: Extension<T, E>): this & E;
}

// `Store` is an intersection rather than `interface ... extends Updater<T>`
// because an interface cannot extend a generic mapped type.
export type Store<T> = Updater<T> & StoreCore<T>;

const capitalize = (str: string) =>
  str.charAt(0).toUpperCase().concat(str.slice(1));

const uncapitalize = (str: string) =>
  str.charAt(0).toLowerCase().concat(str.slice(1));

const SETTER_PREFIX = "set";

/** Core store members that an extension is not allowed to shadow. */
const RESERVED_MEMBERS = new Set<string>(["state", "subscribe", "with"]);

const isUpdaterFn = <Value>(
  value: SetterArg<Value>
): value is (previous: Value) => Value => typeof value === "function";

/**
 * Create a type-safe store with auto-generated `setX` updaters for every key.
 *
 * - Setters accept a value or a functional updater: `setCount((n) => n + 1)`.
 * - `subscribe(listener)` is notified on every committed change and returns an
 *   unsubscribe function.
 * - `with((ctx) => ({ ... }))` adds custom members built on the `state` / `set`
 *   / `subscribe` primitives. It is chainable and each call is independently
 *   type-inferred, so you can compose reset, batch-update, persistence, etc.
 *   without touching the core.
 *
 * ```ts
 * const store = createStore({ count: 0 })
 *   .with((s) => ({ increment: () => s.set("count", (n) => n + 1) }));
 *
 * const off = store.subscribe((state, change) => console.log(change));
 * store.increment(); // -> { key: "count", previous: 0, value: 1 }
 * off();
 * ```
 */
export const createStore = <T extends object = StateShape>(
  initialState: T
): Store<T> => {
  const state = { ...initialState } as T;
  const listeners = new Set<Listener<T>>();
  const extensions = new Map<string, unknown>();

  // Exact setter-name -> key mapping for the keys provided at creation. This
  // preserves keys whose first character is already uppercase (e.g. `userAGE`),
  // which a blind `uncapitalize` of the setter name could not recover.
  const keyBySetter = new Map<string, keyof T>();
  for (const key of Object.keys(initialState)) {
    keyBySetter.set(`${SETTER_PREFIX}${capitalize(key)}`, key as keyof T);
  }

  const subscribe = (listener: Listener<T>): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  // Single write path: resolves functional updaters and notifies subscribers.
  const set = <Key extends keyof T>(
    key: Key,
    value: SetterArg<T[Key]>
  ): void => {
    const previous = state[key];
    const next = isUpdaterFn(value) ? value(previous) : value;

    if (Object.is(previous, next)) {
      return;
    }

    state[key] = next;

    const change = { key, previous, value: next } as Change<T>;
    // Iterate a snapshot so listeners may (un)subscribe during notification.
    for (const listener of [...listeners]) {
      listener(state, change);
    }
  };

  const context: StoreContext<T> = { state, set, subscribe };

  const setterCache = new Map<string, (value: SetterArg<T[keyof T]>) => void>();
  const resolveSetter = (prop: string) => {
    let setter = setterCache.get(prop);
    if (!setter) {
      const key =
        keyBySetter.get(prop) ??
        // A setter for a key not present at creation (e.g. an omitted optional
        // field); derive the key heuristically.
        (uncapitalize(prop.slice(SETTER_PREFIX.length)) as keyof T);
      setter = (value) => set(key, value as SetterArg<T[typeof key]>);
      setterCache.set(prop, setter);
    }
    return setter;
  };

  const withExtension = <E extends object>(
    extend: Extension<T, E>
  ): Store<T> & E => {
    const members = extend(context);
    for (const [key, value] of Object.entries(members)) {
      if (RESERVED_MEMBERS.has(key)) {
        throw new Error(
          `intellistore: extension cannot override reserved member "${key}"`
        );
      }
      extensions.set(key, value);
    }
    return store as Store<T> & E;
  };

  // Setters resolve lazily through a Proxy, so the generated type and the
  // runtime always agree, even for optional keys omitted at creation.
  const store: Store<T> = new Proxy({} as Store<T>, {
    get(_target, prop) {
      if (prop === "state") return state;
      if (prop === "subscribe") return subscribe;
      if (prop === "with") return withExtension;

      if (typeof prop === "string") {
        if (extensions.has(prop)) {
          return extensions.get(prop);
        }
        if (
          prop.length > SETTER_PREFIX.length &&
          prop.startsWith(SETTER_PREFIX)
        ) {
          return resolveSetter(prop);
        }
      }

      return undefined;
    },
  });

  return store;
};
