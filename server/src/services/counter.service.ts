import type { ClientSession } from 'mongoose';
import { Counter } from '../models/counter.model';

/** Atomically increments and returns the next value of a named sequence. */
export async function nextSeq(name: string, session: ClientSession): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );
  return doc!.seq;
}
