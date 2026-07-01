import { Schema, model } from 'mongoose';

export const SETTINGS_ID = 'singleton';

export interface ICompanySettings {
  _id: string;
  companyName: string;
  currency: string;
  businessTimezone: string;
  defaultSaleRateMinor: number; // money per kg, minor units
  tax: { enabled: boolean; ratePercent: number };
  openingLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const companySettingsSchema = new Schema<ICompanySettings>(
  {
    _id: { type: String, default: SETTINGS_ID },
    companyName: { type: String, default: 'My LPG Distribution' },
    currency: { type: String, default: 'PKR' },
    businessTimezone: { type: String, required: true },
    defaultSaleRateMinor: { type: Number, default: 0 },
    tax: {
      enabled: { type: Boolean, default: false }, // no tax in V1 (Q3)
      ratePercent: { type: Number, default: 0 },
    },
    openingLocked: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const CompanySettings = model<ICompanySettings>('CompanySettings', companySettingsSchema);
