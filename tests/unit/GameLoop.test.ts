import { GameLoop } from '@/game/engine/GameLoop';

describe('GameLoop', () => {
  it('runs fixed updates based on accumulated time', () => {
    let updateCount = 0;
    let renderCount = 0;

    const loop = new GameLoop({
      onFixedUpdate: () => {
        updateCount++;
      },
      onRender: () => {
        renderCount++;
      },
    });

    // Start manually
    loop.start(() => 0);

    // First frame initializes baseline timestamp
    loop.step(1000);
    expect(updateCount).toBe(0);
    expect(renderCount).toBe(1);

    // Advance 50ms (approx 3 fixed steps of 16.667ms)
    loop.step(1050);
    expect(updateCount).toBe(3);
    expect(renderCount).toBe(2);

    loop.stop(() => {});
  });

  it('clamps large frame deltas to prevent spiral of death after suspension', () => {
    let updateCount = 0;

    const loop = new GameLoop(
      {
        onFixedUpdate: () => {
          updateCount++;
        },
        onRender: () => {},
      },
      {
        maxFrameDeltaSeconds: 0.1, // Max 100ms
        maxCatchUpSteps: 5,
      }
    );

    loop.start(() => 0);
    loop.step(1000);

    // Simulate returning after 10 seconds of app suspension
    loop.step(11000);

    // Max catch-up steps is 5, delta is clamped to 100ms (~6 steps), so updateCount <= 5
    expect(updateCount).toBe(5);

    loop.stop(() => {});
  });

  it('stops fixed updates while paused and resumes cleanly', () => {
    let updateCount = 0;
    let renderCount = 0;

    const loop = new GameLoop({
      onFixedUpdate: () => {
        updateCount++;
      },
      onRender: () => {
        renderCount++;
      },
    });

    loop.start(() => 0);
    loop.step(1000);

    loop.pause();
    loop.step(1100);

    // Render still runs when paused, but simulation updates are frozen
    expect(updateCount).toBe(0);
    expect(renderCount).toBe(2);

    loop.resume();
    // First step establishes clean baseline without time jump
    loop.step(1150);
    expect(updateCount).toBe(0);

    // Second step simulates elapsed time after resume
    loop.step(1200);
    expect(updateCount).toBeGreaterThan(0);

    loop.stop(() => {});
  });
});
