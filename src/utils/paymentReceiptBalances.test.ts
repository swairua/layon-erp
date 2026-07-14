import { strict as assert } from 'node:assert';
import { getReceiptBalances, ReceiptPayment } from './paymentReceiptBalances';

const allocation = (id: string, amount: number, createdAt?: string, invoiceId = 'invoice-1') => ({
  id,
  invoice_id: invoiceId,
  invoice_number: 'INV-001',
  allocated_amount: amount,
  invoice_total: 1000,
  allocation_created_at: createdAt,
});

const payments: ReceiptPayment[] = [
  {
    id: 'payment-2',
    created_at: '2026-06-02T10:00:00Z',
    payment_allocations: [allocation('allocation-2', 300)],
  },
  {
    id: 'payment-1',
    created_at: '2026-06-01T10:00:00Z',
    payment_allocations: [
      allocation('allocation-1', 200),
      allocation('allocation-3', 100, '2026-06-01T10:01:00Z'),
    ],
  },
];

const balances = getReceiptBalances(payments);
assert.deepEqual(balances.get('payment-1:allocation-1'), { previous_balance: 1000, current_balance: 800 });
assert.deepEqual(balances.get('payment-1:allocation-3'), { previous_balance: 800, current_balance: 700 });
assert.deepEqual(balances.get('payment-2:allocation-2'), { previous_balance: 700, current_balance: 400 });

const overpayment = getReceiptBalances([{
  id: 'payment-3',
  payment_date: '2026-06-03',
  payment_allocations: [allocation('allocation-4', 1500)],
}]);
assert.deepEqual(overpayment.get('payment-3:allocation-4'), { previous_balance: 1000, current_balance: 0 });

const tiedPayments = getReceiptBalances([
  { id: 'payment-b', created_at: '2026-06-04T10:00:00Z', payment_allocations: [allocation('b', 100)] },
  { id: 'payment-a', created_at: '2026-06-04T10:00:00Z', payment_allocations: [allocation('a', 100)] },
]);
assert.deepEqual(tiedPayments.get('payment-a:a'), { previous_balance: 1000, current_balance: 900 });
assert.deepEqual(tiedPayments.get('payment-b:b'), { previous_balance: 900, current_balance: 800 });
