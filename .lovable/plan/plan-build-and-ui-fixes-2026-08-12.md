# Plan - Build and UI Fixes

The system is experiencing build failures due to duplicate JavaScript/TypeScript files and route conflicts for `/financeiro`. Additionally, there was a request to remove a specific invisible separator character `\u2063` which was used as a hack in some components.

## User Review Required

> [!IMPORTANT]
> - I have deleted `src/components/new-client-wizard.js` as it was a duplicate of `src/components/new-client-wizard.tsx`.
> - I am checking if there are other `.js` files causing conflicts.

## Proposed Changes

### Build and Infrastructure
- Remove any remaining `.js` files in `src/` that conflict with `.tsx` files.
- Verify `src/routes/_authenticated/financeiro.tsx` is the unique owner of the `/financeiro` route.

### UI and Content
- Clean up any instances of the invisible separator `\u2063` if found in state or components (though preliminary search showed no hardcoded instances in source, it might be in database content which I will check).
- Fix a minor state bug in `src/routes/_authenticated/financeiro.tsx` where `setSaving(true)` was used instead of `false` after a deletion.

### Backend/Data
- Inspect the `clients` and `monthly_fees` tables for any content containing `\u2063` and clean it up if requested (the user provided a specific "Change text" instruction which usually refers to a selected element).

## Technical Details
- Command: `rm src/components/new-client-wizard.js` (Already executed to unblock analysis).
- Logic correction in `src/routes/_authenticated/financeiro.tsx` for the delete action.
- Investigation of the route conflict error: `Conflicting configuration paths were found for the following routes: "/financeiro"`. This is usually caused by having both `financeiro.tsx` and a `financeiro/route.tsx` or a `.js` version.

## Validation Plan
- Run `npm run build` (simulated via `build:dev` check) to ensure the route conflict is resolved.
- Check the Financeiro page to ensure the "Nova mensalidade" and "Excluir" actions work correctly.
