/**
 * Текст Markdown без разметки — для превью объявлений и текста push-уведомлений.
 * Упрощённый разбор: убирает синтаксис, который встречается в объявлениях, а не весь CommonMark.
 */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[^\n]*\n([\s\S]*?)```/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, '')
    .replace(/^\s{0,3}([-*_]\s*){3,}$/gm, '')
    .replace(/(\*\*|__|~~|`)(.+?)\1/g, '$2')
    .replace(/(^|[^\w*])[*_](\S(?:.*?\S)?)[*_](?=[^\w*]|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Начало текста не длиннее max символов, обрезанное по границе слова. */
export function excerpt(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?—-]+$/, '')}…`;
}
