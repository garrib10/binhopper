/** Goldmine record grades, best to worst (SPEC.md › Collection rule 2). */
export const GRADES = ['M', 'NM', 'VG+', 'VG', 'G+', 'G', 'P'] as const;
export type Grade = (typeof GRADES)[number];

export const GRADE_NAMES: Record<Grade, string> = {
  M: 'Mint', NM: 'Near Mint', 'VG+': 'Very Good Plus', VG: 'Very Good', 'G+': 'Good Plus', G: 'Good', P: 'Poor',
};
