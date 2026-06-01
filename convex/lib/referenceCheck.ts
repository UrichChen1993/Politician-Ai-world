export type ReferenceCheck = {
  // Cited article numbers that do not exist in the bill. Non-fatal: the vote is
  // still recorded, but the call is tagged errorKind "hallucinated_reference"
  // (poc-plan §5.2).
  hallucinated: number[];
};

export function checkReferences(
  citedArticles: number[],
  validArticleNos: number[],
): ReferenceCheck {
  const valid = new Set(validArticleNos);
  const hallucinated: number[] = [];
  for (const n of citedArticles) {
    if (!valid.has(n) && !hallucinated.includes(n)) hallucinated.push(n);
  }
  return { hallucinated };
}
