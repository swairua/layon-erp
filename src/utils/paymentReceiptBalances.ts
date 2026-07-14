export interface ReceiptAllocation {
  id: string;
  invoice_id?: string | null;
  invoice_number: string;
  allocated_amount: number;
  invoice_total: number;
  allocation_created_at?: string | null;
}

export interface ReceiptPayment {
  id: string;
  created_at?: string | null;
  payment_date?: string | null;
  payment_allocations?: ReceiptAllocation[];
}

export interface ReceiptBalance {
  previous_balance: number;
  current_balance: number;
}

const timestampValue = (value?: string | null) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
};

export function getReceiptBalances(
  payments: ReceiptPayment[],
  invoiceTotals: Map<string, number> = new Map(),
): Map<string, ReceiptBalance> {
  const allocations = payments.flatMap((payment, paymentIndex) =>
    (payment.payment_allocations || []).map((allocation, allocationIndex) => ({
      payment,
      allocation,
      paymentIndex,
      allocationIndex,
    })),
  );

  const byInvoice = new Map<string, typeof allocations>();
  allocations.forEach((entry) => {
    const invoiceKey = entry.allocation.invoice_id || entry.allocation.invoice_number;
    const invoiceAllocations = byInvoice.get(invoiceKey) || [];
    invoiceAllocations.push(entry);
    byInvoice.set(invoiceKey, invoiceAllocations);
  });

  const balances = new Map<string, ReceiptBalance>();

  byInvoice.forEach((invoiceAllocations) => {
    invoiceAllocations.sort((a, b) => {
      const paymentTime = timestampValue(a.payment.created_at || a.payment.payment_date)
        - timestampValue(b.payment.created_at || b.payment.payment_date);
      if (paymentTime !== 0) return paymentTime;

      const allocationTime = timestampValue(a.allocation.allocation_created_at)
        - timestampValue(b.allocation.allocation_created_at);
      if (allocationTime !== 0) return allocationTime;

      const idOrder = a.allocation.id.localeCompare(b.allocation.id);
      if (idOrder !== 0) return idOrder;

      return a.paymentIndex - b.paymentIndex || a.allocationIndex - b.allocationIndex;
    });

    const firstAllocation = invoiceAllocations[0].allocation;
    const invoiceTotal = invoiceTotals.get(firstAllocation.invoice_id || '')
      ?? Number(firstAllocation.invoice_total || 0);
    let runningBalance = invoiceTotal;

    invoiceAllocations.forEach(({ payment, allocation }) => {
      const previousBalance = runningBalance;
      const currentBalance = Math.max(0, previousBalance - Number(allocation.allocated_amount || 0));
      balances.set(`${payment.id}:${allocation.id}`, {
        previous_balance: previousBalance,
        current_balance: currentBalance,
      });
      runningBalance = currentBalance;
    });
  });

  return balances;
}
