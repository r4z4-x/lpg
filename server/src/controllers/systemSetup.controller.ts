import type { Request, Response } from 'express';
import { ok } from '../utils/response';
import { Money } from '../utils/money';
import * as settingsService from '../services/companySettings.service';
import * as cylinderTypeService from '../services/cylinderType.service';
import * as paymentAccountService from '../services/paymentAccount.service';
import * as openingService from '../services/openingBalance.service';

// --- Settings ---
export async function getSettings(_req: Request, res: Response): Promise<void> {
  ok(res, { settings: await settingsService.getSettings() });
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  const { defaultSaleRate, ...rest } = req.body as {
    defaultSaleRate?: string;
    [k: string]: unknown;
  };
  const patch: settingsService.UpdateSettingsInput = { ...rest };
  if (defaultSaleRate !== undefined) {
    patch.defaultSaleRateMinor = Money.fromMajor(defaultSaleRate).toMinorNumber();
  }
  ok(res, { settings: await settingsService.updateSettings(patch) });
}

// --- Cylinder types ---
export async function createCylinderType(req: Request, res: Response): Promise<void> {
  ok(res, { cylinderType: await cylinderTypeService.createCylinderType(req.body) }, 201);
}

export async function listCylinderTypes(_req: Request, res: Response): Promise<void> {
  ok(res, { cylinderTypes: await cylinderTypeService.listCylinderTypes() });
}

export async function updateCylinderType(req: Request, res: Response): Promise<void> {
  ok(res, {
    cylinderType: await cylinderTypeService.updateCylinderType(req.params.id!, req.body),
  });
}

// --- Payment accounts ---
export async function createPaymentAccount(req: Request, res: Response): Promise<void> {
  ok(res, { paymentAccount: await paymentAccountService.createPaymentAccount(req.body) }, 201);
}

export async function listPaymentAccounts(_req: Request, res: Response): Promise<void> {
  ok(res, { paymentAccounts: await paymentAccountService.listPaymentAccounts() });
}

// --- Opening balances ---
export async function postOpeningBalances(req: Request, res: Response): Promise<void> {
  const result = await openingService.postOpeningBalances(req.body, req.user!.id);
  ok(res, result, 201);
}
