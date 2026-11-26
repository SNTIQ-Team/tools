/**
 * Correct the narrowly evidenced upstream classification error for complete
 * Landratsamt office roots.  Departments and specialist authority records
 * retain their API kind; the structural parent is the decisive guard for
 * short names such as the real child row "Landratsamt IT".
 */
export const normaliseAuthorityKind = (
  kind: string,
  name: string,
  hasStructuralParent: boolean,
) => kind === 'sonstige' && !hasStructuralParent &&
  /^Landratsamt\s+\S/i.test(name) && !name.includes(' - ')
    ? 'landratsamt' : kind;
