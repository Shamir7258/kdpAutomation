import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    hookTimeout: 30_000,
    testTimeout: 20_000,
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup-env.ts'],
    // Each test file's beforeAll spins up its own real mongodb-memory-server instance (and the
    // content-generation file also starts a real BullMQ worker). Running ~10 of those
    // concurrently causes CPU/IO contention heavy enough to make the BullMQ integration tests
    // flaky (job pickup latency balloons under contention — verified this isn't a logic bug by
    // running that file alone, where it passes reliably in ~25s). Sequential file execution
    // trades some wall-clock time for eliminating that whole class of flakiness.
    fileParallelism: false,
  },
});
