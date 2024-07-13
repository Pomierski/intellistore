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
});
