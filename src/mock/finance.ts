/* ============================================================================
   W5 · Time, payroll & finance fixtures — public surface.

   Split by area so no single file grows unwieldy. Every payroll figure in these
   files is derived from `@/mock/payroll` (payRunRows / computeAmounts / PAY_RUNS),
   so a register, a bank advice file or a return can never disagree with the run.
   ========================================================================== */

export * from "./finance-time";
export * from "./finance-payroll";
export * from "./finance-loans";
export * from "./finance-run";
export * from "./finance-statutory";
export * from "./finance-expense";
export * from "./finance-travel";
