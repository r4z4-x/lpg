import mongoose, { ClientSession } from "mongoose";

export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession();

  console.log("SESSION CREATED");

  try {
    let result: T;

    await session.withTransaction(async () => {
      console.log("TRANSACTION STARTED");

      result = await fn(session);

      console.log("TRANSACTION FINISHED");
    });

    return result!;
  } catch (err) {
    console.error("TRANSACTION ERROR:", err);
    throw err;
  } finally {
    await session.endSession();
  }
}