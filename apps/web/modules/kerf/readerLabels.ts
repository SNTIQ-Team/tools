export function readerLawLabel(act: { id: string; jurabk: string }): string {
  if (act.id === 'fed_asylvfg_1992') return 'AsylG';
  const label = act.jurabk.replace(/\s+(?:19|20)\d{2}$/, '');
  const book = /^SGB\s+(\d{1,2})$/.exec(label);
  const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV'];
  return book && roman[Number(book[1])] ? `SGB ${roman[Number(book[1])]}` : label;
}
