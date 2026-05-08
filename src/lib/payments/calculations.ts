import { Prisma } from "@prisma/client";
import { splitGrossCommissionPaise } from "./commission.js";

export type PaymentBreakdown = {
  grossAmountPaise: number;
  platformFeePaise: number;
  providerSharePaise: number;
};

export function toRupeeDecimalFromPaise(amountPaise: number): Prisma.Decimal {
  return new Prisma.Decimal((amountPaise / 100).toFixed(2));
}

export function computePaymentBreakdown(amountDecimal: Prisma.Decimal, commissionRate: number): PaymentBreakdown {
  const grossAmountPaise = Math.round(Number(amountDecimal) * 100);
  const { platformFeePaise, providerSharePaise } = splitGrossCommissionPaise(grossAmountPaise, commissionRate);
  return { grossAmountPaise, platformFeePaise, providerSharePaise };
}
