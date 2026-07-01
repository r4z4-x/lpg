import { Schema, model } from 'mongoose';

/** Atomic sequence generator (e.g. ledger entry numbers, invoice numbers). */
const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

export const Counter = model('Counter', counterSchema);
