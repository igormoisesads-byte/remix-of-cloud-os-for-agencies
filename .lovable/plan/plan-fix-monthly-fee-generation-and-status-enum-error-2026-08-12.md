# Plan - Fix Monthly Fee Generation and Status Enum Error

The user reported two issues:
1. **Invalid Enum Value**: An error `invalid input value for enum fee_status: "paid"` when marking a fee as paid. This is likely due to the database using `pago` (Portuguese) while some code or trigger uses `paid` (English).
2. **Excessive Fee Generation**: Monthly fees are being generated up to 2027 even when a `contract_end` date is set (e.g., if `contract_end` is shorter than 12 months, or the logic is incorrectly extending).

## User Review Required

> [!IMPORTANT]
> The system currently generates fees up to the `contract_end` date provided in the wizard. If no `contract_end` is provided, it defaults to 12 months from the start date. I will ensure it strictly respects the `contract_end` date and does not generate fees beyond it.

## Proposed Changes

### Database & Backend
- Update the `tg_monthly_fees_audit` function in Supabase to use `pago` instead of `paid` in its logic to match the `fee_status` enum definition (`'pendente', 'pago', 'atrasado', 'cancelado'`).

### Client Wizard (`src/components/new-client-wizard.tsx`)
- Refine the loop that generates monthly fees to ensure the `endCursor` (which represents the contract end) is correctly calculated and that the `while` loop condition strictly stops at that date.
- Ensure that if `contract_end` is present, it takes absolute precedence over the default 12-month period.

### Client Details (`src/routes/_authenticated/clientes.$id.tsx`)
- Verify and fix any similar fee generation logic if present in the client editing/updating view.

## Technical Details

### 1. Fix Audit Trigger
The trigger function `public.tg_monthly_fees_audit` has a hardcoded `'paid'` string:
```sql
CASE WHEN NEW.status='paid' THEN 'Mensalidade paga' ELSE 'Mensalidade '||NEW.status END
```
I will change it to `'pago'`.

### 2. Fix Wizard Loop
In `src/components/new-client-wizard.tsx`:
```typescript
const end = form.contract_end ? new Date(form.contract_end + "T00:00:00") : new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
// ...
const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);
while (cursor <= endCursor) {
  // ...
  cursor.setMonth(cursor.getMonth() + 1);
}
```
If `form.contract_end` is, for example, `2026-12-31`, `endCursor` becomes `2026-12-01`. The loop correctly generates for Dec 2026. However, if there's any off-by-one or timezone issue, it might jump. I will add safer date handling.
