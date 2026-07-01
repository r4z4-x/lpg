import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from 'vitest';

/**
 * Registers lifecycle hooks that start an in-memory single-node MongoDB *replica set*
 * (so multi-document transactions work) for the calling test file, connect mongoose,
 * clear collections between tests, and tear everything down afterwards.
 */
export function useTestDb(): void {
  let replset: MongoMemoryReplSet;

  beforeAll(async () => {
    replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replset.getUri());
  });

  afterEach(async () => {
    const collections = await mongoose.connection.db!.collections();
    for (const c of collections) {
      await c.deleteMany({});
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replset.stop();
  });
}
