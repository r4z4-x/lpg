import { Types } from 'mongoose';
import { InventoryAdjustment } from '../models/inventoryAdjustment.model';
import { Quantity } from '../utils/quantity';
import { withTransaction } from '../utils/transaction';
import { toBusinessDate } from '../utils/businessDay';
import { ValidationError } from '../utils/errors';
import { getSettings } from './companySettings.service';
import * as costing from './costing.service';
import * as inventory from './inventory.service';
import * as ledger from './ledger.service';
import * as audit from './audit.service';
import type { CountField } from './inventory.service';

export interface CreateAdjustmentInput {
  type: 'leakage' | 'damage' | 'correction';
  reason: string;
  gas?: { kg: string; direction: 'decrease' | 'increase' };
  cylinder?: { cylinderTypeId: string; deltas: Partial<Record<CountField, number>> };
}

/**
 * Records an inventory adjustment. Gas changes are valued at WAC and posted:
 *   decrease → Dr Inventory Loss (5020) / Cr Gas Inventory (1200)
 *   increase → Dr Gas Inventory (1200) / Cr Inventory Loss (5020)
 * Cylinder count corrections move shells without a ledger valuation. Owner-only.
 */
export async function createAdjustment(input: CreateAdjustmentInput, userId: string) {
  if (!input.gas && !input.cylinder) {
    throw new ValidationError('Adjustment must include a gas and/or cylinder change');
  }

  return withTransaction(async (session) => {
    const settings = await getSettings(session);
    const date = new Date();
    const businessDate = toBusinessDate(date, settings.businessTimezone);

    let gasKgDeltaSub = 0n;
    let valuationImpactMinor = 0;
    let ledgerEntryId: Types.ObjectId | null = null;

    if (input.gas) {
      const magnitude = Quantity.fromKg(input.gas.kg);
      if (magnitude.isZero()) throw new ValidationError('Gas adjustment quantity must be positive');
      gasKgDeltaSub = input.gas.direction === 'decrease' ? -magnitude.toSub() : magnitude.toSub();

      valuationImpactMinor = await costing.adjustGas(gasKgDeltaSub, session);
      const abs = Math.abs(valuationImpactMinor);
      if (abs > 0) {
        const lines =
          input.gas.direction === 'decrease'
            ? [
                { accountCode: '5020', debitMinor: abs },
                { accountCode: '1200', creditMinor: abs },
              ]
            : [
                { accountCode: '1200', debitMinor: abs },
                { accountCode: '5020', creditMinor: abs },
              ];
        const entry = await ledger.post(
          { date, businessDate, sourceType: 'Adjustment', memo: `Inventory ${input.type}: ${input.reason}`, createdBy: userId, lines },
          session,
        );
        ledgerEntryId = entry._id;
      }
    }

    if (input.cylinder) {
      await inventory.adjust(input.cylinder.cylinderTypeId, input.cylinder.deltas, session);
    }

    const [adjustment] = await InventoryAdjustment.create(
      [
        {
          type: input.type,
          gasKgDeltaSub: Number(gasKgDeltaSub),
          valuationImpactMinor,
          cylinderTypeId: input.cylinder?.cylinderTypeId ?? null,
          cylinderDeltas: input.cylinder?.deltas ?? {},
          reason: input.reason,
          ledgerEntryId,
          createdBy: userId,
        },
      ],
      { session },
    );

    await audit.record(
      { userId, action: 'create', entity: 'InventoryAdjustment', entityId: adjustment!._id, newValue: input },
      session,
    );
    return adjustment!;
  });
}

export function listAdjustments() {
  return InventoryAdjustment.find().sort({ createdAt: -1 });
}
