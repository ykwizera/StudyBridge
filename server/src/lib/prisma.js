import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// BigInt (recording sizes) is not JSON serialisable by default.
BigInt.prototype.toJSON = function () {
  return Number(this);
};
