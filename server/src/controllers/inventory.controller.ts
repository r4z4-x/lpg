import type { Request, Response } from 'express';
import { ok } from '../utils/response';
import { Money } from '../utils/money';
import { Quantity } from '../utils/quantity';
import * as costing from '../services/costing.service';
import * as inventory from '../services/inventory.service';

export async function getGas(_req: Request, res: Response): Promise<void> {
  const gas = await costing.getGasInventory();
  ok(res, {
    gas: {
      availableKg: Quantity.fromSub(BigInt(gas.availableKgSub)).toKgString(),
      weightedAvgCost: Money.fromMinor(BigInt(gas.wacMinor)).toMajorString(),
      inventoryValue: Money.fromMinor(BigInt(gas.inventoryValueMinor)).toMajorString(),
    },
  });
}

export async function listCylinders(_req: Request, res: Response): Promise<void> {
  ok(res, { cylinders: await inventory.listCylinderInventory() });
}
