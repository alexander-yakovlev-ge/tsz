import { normalizeName } from '@tsz/shared';

export function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current.push(
        Math.min(
          previous[j]! + 1,
          current[j - 1]! + 1,
          previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
        ),
      );
    }
    previous = current;
  }
  return previous[b.length]!;
}

/** Слова имени без повторов: «შპს შპს X» = «შპს X». */
function words(name: string): string[] {
  return [...new Set(name.split(' '))];
}

/**
 * Опечатка: слова совпадают, кроме одного, а оно отличается на одну букву
 * (на две — в словах от 10 букв). Члены одной семьи — «Мая Козлова» и «Лаша Козлова» —
 * отличаются целым словом и похожими не считаются.
 */
function isTypo(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const unmatchedLeft = left.filter((word) => !right.includes(word));
  const unmatchedRight = right.filter((word) => !left.includes(word));
  if (unmatchedLeft.length !== 1 || unmatchedRight.length !== 1) {
    return false;
  }
  const a = unmatchedLeft[0]!;
  const b = unmatchedRight[0]!;
  const limit = Math.min(a.length, b.length) >= 10 ? 2 : 1;
  return Math.abs(a.length - b.length) <= limit && levenshtein(a, b) <= limit;
}

export type NameMatch = 'exact' | 'similar' | null;

/**
 * Сравнение имён из выписки (ТЗ v1.10, п. 8.10). Точное — после normalizeName.
 * Похожее — те же слова в другом порядке или опечатка в одном слове.
 */
export function compareNames(a: string, b: string): NameMatch {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (left === right) {
    return 'exact';
  }
  const leftWords = words(left);
  const rightWords = words(right);
  if ([...leftWords].sort().join(' ') === [...rightWords].sort().join(' ')) {
    return 'similar';
  }
  return isTypo(leftWords, rightWords) ? 'similar' : null;
}
