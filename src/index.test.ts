import { createStore } from "./index";

describe("createState", () => {
  it("should initialize state with given initial state", () => {
    const initialState = { name: "John", age: 25 };
    const { state } = createStore(initialState);

    expect(state).toEqual(initialState);
  });

  it("should create updater methods for each key in the initial state", () => {
    const initialState = { name: "John", age: 25 };
    const { setName, setAge } = createStore(initialState);

    expect(typeof setName).toBe("function");
    expect(typeof setAge).toBe("function");
  });

  it("should update the state when updater methods are called", () => {
    const initialState = { name: "John", age: 25 };
    const { state, setName, setAge } = createStore(initialState);

    setName("Bob");
    expect(state.name).toBe("Bob");

    setAge(30);
    expect(state.age).toBe(30);
  });

  it("should handle initial state with different data types", () => {
    const initialState = {
      count: 10,
      isActive: true,
      data: { nested: "value" },
    };
    const { state, setCount, setIsActive, setData } = createStore(initialState);

    setCount(20);
    expect(state.count).toBe(20);

    setIsActive(false);
    expect(state.isActive).toBe(false);

    setData({ nested: "newValue" });
    expect(state.data).toEqual({ nested: "newValue" });
  });

  it("should handle keys with different cases correctly", () => {
    const initialState = { userName: "John", userAGE: 25 };
    const { state, setUserName, setUserAGE } = createStore(initialState);

    setUserName("Bob");
    expect(state.userName).toBe("Bob");

    setUserAGE(30);
    expect(state.userAGE).toBe(30);
  });

  it("should expose a working setter for an optional key omitted at creation", () => {
    interface OptionalStore {
      name: string;
      age?: number;
    }

    const store = createStore<OptionalStore>({ name: "John" });

    expect(typeof store.setAge).toBe("function");
    expect(store.state.age).toBeUndefined();

    store.setAge(30);
    expect(store.state.age).toBe(30);
  });

  it("should allow initializing an optional key with undefined", () => {
    const { state, setAge } = createStore({
      name: "John",
      age: undefined as number | undefined,
    });

    expect("age" in state).toBe(true);
    expect(state.age).toBeUndefined();

    setAge(42);
    expect(state.age).toBe(42);
  });

  it("should not treat non-setter property access as a function", () => {
    const store = createStore({ name: "John" }) as unknown as Record<
      string,
      unknown
    >;

    expect(store.set).toBeUndefined();
    expect(store.somethingElse).toBeUndefined();
  });

  describe("functional updaters", () => {
    it("should accept an updater function that derives the next value", () => {
      const { state, setCount } = createStore({ count: 10 });

      setCount((current) => current + 5);
      expect(state.count).toBe(15);

      setCount(20);
      expect(state.count).toBe(20);
    });
  });

  describe("subscriptions", () => {
    it("should notify subscribers with the committed change", () => {
      const store = createStore({ count: 0, name: "a" });
      const changes: Array<{ key: string; previous: unknown; value: unknown }> =
        [];

      store.subscribe((_state, change) => {
        changes.push({
          key: change.key as string,
          previous: change.previous,
          value: change.value,
        });
      });

      store.setCount(1);
      store.setName("b");

      expect(changes).toEqual([
        { key: "count", previous: 0, value: 1 },
        { key: "name", previous: "a", value: "b" },
      ]);
    });

    it("should not notify when the value is unchanged", () => {
      const store = createStore({ count: 0 });
      const listener = jest.fn();

      store.subscribe(listener);
      store.setCount(0);

      expect(listener).not.toHaveBeenCalled();
    });

    it("should stop notifying after unsubscribe", () => {
      const store = createStore({ count: 0 });
      const listener = jest.fn();

      const unsubscribe = store.subscribe(listener);
      store.setCount(1);
      unsubscribe();
      store.setCount(2);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(store.state.count).toBe(2);
    });
  });

  describe("extensions", () => {
    it("should add chainable members built on the core primitives", () => {
      const store = createStore({ count: 0 })
        .with((ctx) => ({
          increment: () => ctx.set("count", (n) => n + 1),
          reset: () => ctx.set("count", 0),
        }))
        .with((ctx) => ({
          isZero: () => ctx.state.count === 0,
        }));

      store.increment();
      store.increment();
      expect(store.state.count).toBe(2);
      expect(store.isZero()).toBe(false);

      store.reset();
      expect(store.state.count).toBe(0);
      expect(store.isZero()).toBe(true);
    });

    it("should let extension writes flow through subscribers", () => {
      const store = createStore({ count: 0 }).with((ctx) => ({
        increment: () => ctx.set("count", (n) => n + 1),
      }));
      const listener = jest.fn();

      store.subscribe(listener);
      store.increment();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should refuse to override reserved members", () => {
      expect(() =>
        createStore({ a: 1 }).with(() => ({ state: 123 }) as never)
      ).toThrow(/reserved member/);
    });
  });
});
