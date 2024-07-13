const capitalize = (str: string) =>
  str.charAt(0).toUpperCase().concat(str.slice(1));

export type StateShape = { [Key: string]: unknown };

export type Updater<T> = {
  [Key in keyof T as `set${Capitalize<Extract<Key, string>>}`]: (
    value: T[Key]
  ) => void;
};

export const createStore = <T = StateShape>(initialState: Required<T>) => {
  const state: T = {
    ...initialState,
  };

  const updaters = Object.keys(initialState).reduce((acc, key) => {
    const objectKey = `set${capitalize(key)}` as keyof Updater<T>;
    return {
      ...acc,
      [objectKey]: (newVal: T[keyof T]) => {
        state[key] = newVal;
      },
    };
  }, {} as Updater<T>);

  return {
    state,
    ...updaters,
  };
};
