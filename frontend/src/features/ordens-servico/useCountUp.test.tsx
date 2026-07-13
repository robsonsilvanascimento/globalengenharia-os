import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCountUp } from './useCountUp';

describe('useCountUp', () => {
  let rafCallbacks: FrameRequestCallback[];
  let now: number;

  beforeEach(() => {
    rafCallbacks = [];
    now = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function flushFrame(timestamp: number) {
    const callbacks = rafCallbacks;
    rafCallbacks = [];
    callbacks.forEach((cb) => cb(timestamp));
  }

  it('starts at 0 and animates towards the target value over time', () => {
    const { result } = renderHook(({ valor }) => useCountUp(valor, 700), {
      initialProps: { valor: 100 },
    });

    expect(result.current).toBe(0);

    // First frame establishes the animation's start timestamp (progress = 0).
    act(() => {
      flushFrame(now);
    });
    expect(result.current).toBe(0);

    // Halfway through the duration, the eased value should have grown but not reached the target yet.
    act(() => {
      now += 350;
      flushFrame(now);
    });
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(100);

    // Past the full duration, the animation settles exactly on the target.
    act(() => {
      now += 700;
      flushFrame(now);
    });
    expect(result.current).toBe(100);
  });

  it('re-animates from the last displayed value when the target changes', () => {
    const { result, rerender } = renderHook(({ valor }) => useCountUp(valor, 700), {
      initialProps: { valor: 10 },
    });

    act(() => {
      flushFrame(now);
      now += 700;
      flushFrame(now);
    });
    expect(result.current).toBe(10);

    rerender({ valor: 20 });
    act(() => {
      flushFrame(now);
      now += 700;
      flushFrame(now);
    });
    expect(result.current).toBe(20);
  });
});
