import { Schema, model, type Types } from 'mongoose';

/** A batch of company cylinders held by a customer (created on a no-cylinder sale). */
export interface ICustomerCylinderHolding {
  customerId: Types.ObjectId;
  cylinderTypeId: Types.ObjectId;
  qty: number; // currently outstanding (decremented on return)
  issuedQty: number; // originally issued
  issueDate: Date;
  returnDate: Date | null;
  depositPerUnitMinor: number;
  status: 'held' | 'returned';
  saleId: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const holdingSchema = new Schema<ICustomerCylinderHolding>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    cylinderTypeId: { type: Schema.Types.ObjectId, ref: 'CylinderType', required: true },
    qty: { type: Number, required: true },
    issuedQty: { type: Number, required: true },
    issueDate: { type: Date, required: true },
    returnDate: { type: Date, default: null },
    depositPerUnitMinor: { type: Number, default: 0 },
    status: { type: String, enum: ['held', 'returned'], default: 'held' },
    saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
    createdBy: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
);

holdingSchema.index({ customerId: 1, status: 1 });

export const CustomerCylinderHolding = model<ICustomerCylinderHolding>(
  'CustomerCylinderHolding',
  holdingSchema,
);
