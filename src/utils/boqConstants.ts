export const BOQ_STATUS = {
  DRAFT: 'draft',
  CONVERTED: 'converted',
  CANCELLED: 'cancelled',
} as const;

export type BOQStatus = typeof BOQ_STATUS[keyof typeof BOQ_STATUS];

export const VALID_BOQ_STATUSES: BOQStatus[] = [
  BOQ_STATUS.DRAFT,
  BOQ_STATUS.CONVERTED,
  BOQ_STATUS.CANCELLED,
];

export function isValidBOQStatus(status: unknown): status is BOQStatus {
  return typeof status === 'string' && VALID_BOQ_STATUSES.includes(status as BOQStatus);
}

export function sanitizeBOQStatus(status: unknown): BOQStatus {
  if (isValidBOQStatus(status)) {
    return status;
  }
  console.warn(`Invalid BOQ status: ${status}. Defaulting to 'draft'.`);
  return BOQ_STATUS.DRAFT;
}
