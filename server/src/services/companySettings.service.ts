import type { ClientSession } from 'mongoose';
import { CompanySettings, SETTINGS_ID } from '../models/companySettings.model';
import { env } from '../config/env';

/** Returns the singleton settings, creating defaults on first access. */
export async function getSettings(session?: ClientSession) {
  const existing = await CompanySettings.findById(SETTINGS_ID).session(session ?? null);
  if (existing) return existing;
  const [created] = await CompanySettings.create(
    [{ _id: SETTINGS_ID, businessTimezone: env.BUSINESS_TIMEZONE }],
    session ? { session } : {},
  );
  return created!;
}

export interface UpdateSettingsInput {
  companyName?: string;
  currency?: string;
  businessTimezone?: string;
  defaultSaleRateMinor?: number;
  tax?: { enabled: boolean; ratePercent: number };
}

export async function updateSettings(input: UpdateSettingsInput) {
  await getSettings(); // ensure it exists
  const updated = await CompanySettings.findByIdAndUpdate(
    SETTINGS_ID,
    { $set: input },
    { new: true },
  );
  return updated!;
}
