/**
 * The page of ZP 1a a step fills, so the live preview turns to it when the
 * step changes (read from the template's widgets: A to D on page 1, E on 2,
 * F and G on 3, H to K on 4). The person can still page by hand.
 */
const PAGE: Record<string, number> = {
  intro: 1, personal: 1, insurance: 1, maintenance: 1, dependents: 1,
  income: 2, partnerIncome: 2,
  deductions: 3, assets: 3,
  housing: 4, obligations: 4, special: 4, declaration: 4,
};

export function previewPageFor(stepId: string): number | null {
  return PAGE[stepId] ?? null;
}
