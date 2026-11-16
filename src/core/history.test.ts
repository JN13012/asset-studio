import { describe, expect, it } from 'vitest';
import { emptyHistory, HISTORY_LIMIT, recordHistory, stepHistory, trimHistory } from './history';

describe('document history', () => {
  it('undoes and redoes in order', () => {
    const h = recordHistory(recordHistory(emptyHistory<number>(), 1), 2);
    const undone = stepHistory(h, 3, 'undo')!;
    expect(undone.current).toBe(2);
    expect(stepHistory(undone.history, undone.current, 'redo')).toEqual({ current: 3, history: h });
  });
  it('discards redo after a new change', () => {
    expect(recordHistory({ past: [1], future: [3] }, 2)).toEqual({ past: [1, 2], future: [] });
  });
  it('bounds the number of retained snapshots', () => {
    let h = emptyHistory<number>();
    for (let i = 0; i < 100; i++) h = recordHistory(h, i);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.past[0]).toBe(100 - HISTORY_LIMIT);
  });
  it('drops oldest snapshots when over the resource budget', () => {
    expect(trimHistory({ past: [1, 2, 3], future: [] }, h => h.past.length <= 1)).toEqual({ past: [3], future: [] });
  });
  it('does nothing when no step is available', () => {
    expect(stepHistory(emptyHistory(), 1, 'undo')).toBeNull();
    expect(stepHistory(emptyHistory(), 1, 'redo')).toBeNull();
  });
});
