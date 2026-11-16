export interface History<T> {
  past: T[];
  future: T[];
}

export const HISTORY_LIMIT = 30;

export function emptyHistory<T>(): History<T> {
  return { past: [], future: [] };
}

export function recordHistory<T>(history: History<T>, current: T): History<T> {
  return { past: [...history.past, current].slice(-HISTORY_LIMIT), future: [] };
}

export function trimHistory<T>(history: History<T>, fits: (candidate: History<T>) => boolean): History<T> {
  let next = history;
  while (!fits(next) && next.past.length) next = { ...next, past: next.past.slice(1) };
  return next;
}

export function stepHistory<T>(history: History<T>, current: T, direction: 'undo' | 'redo'): { current: T; history: History<T> } | null {
  if (direction === 'undo') {
    if (!history.past.length) return null;
    return {
      current: history.past[history.past.length - 1],
      history: { past: history.past.slice(0, -1), future: [current, ...history.future] },
    };
  }
  if (!history.future.length) return null;
  return {
    current: history.future[0],
    history: { past: [...history.past, current], future: history.future.slice(1) },
  };
}
