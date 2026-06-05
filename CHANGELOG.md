# Changelog

## 2.0.0 (2025-06-05)

No breaking changes to the existing API — all v1 code continues to work
unchanged. Bumped major because the internal architecture moved to a Proxy-based
design and the public type surface expanded significantly.

### Added

- **Optional fields:** `age?: number` now works directly — no need for the
  `age: number | undefined` workaround. Omitted keys still get a working setter
  at both the type level and runtime.
- **Functional updaters:** every setter accepts `(previous) => next` in addition
  to a plain value.
- **Subscriptions:** `subscribe(listener)` fires on every committed change and
  returns an unsubscribe function. Listeners receive the state and a
  discriminated `change` object. No-op writes (same value via `Object.is`) are
  skipped.
- **Extension API:** chainable `.with((ctx) => ({ ... }))` lets users add custom
  members (batch updates, persistence, undo/redo, etc.) built on the `state`,
  `set`, and `subscribe` primitives without touching the core.
- `tsconfig.json` for proper type-checking and declaration output.

### Changed

- Store internals now use a `Proxy` for lazy setter resolution — setters for
  optional keys that were omitted at creation are resolved on first access.
- `Store<T>` is an intersection type (`Updater<T> & StoreCore<T>`) instead of a
  plain object type, enabling the `with` chain to accumulate extension types.

## 1.0.0

Initial release.

- Auto-generated `setX` updater for every key in the initial state object.
- Full type inference from a plain object literal.
