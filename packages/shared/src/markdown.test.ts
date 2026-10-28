import { excerpt, markdownToPlainText } from './markdown';

describe('markdownToPlainText', () => {
  it('drops markup but keeps the words', () => {
    const markdown = [
      '## Отключение воды',
      '',
      '**Завтра** с 10:00 до _14:00_ — см. [график](https://example.com/plan.pdf).',
      '',
      '- подъезд 1',
      '- подъезд 2',
      '> Просим отнестись с пониманием',
    ].join('\n');
    expect(markdownToPlainText(markdown)).toBe(
      'Отключение воды Завтра с 10:00 до 14:00 — см. график. подъезд 1 подъезд 2 Просим отнестись с пониманием',
    );
  });

  it('keeps snake_case words and inline code text', () => {
    expect(markdownToPlainText('файл `units_2026.csv` и snake_case_name')).toBe(
      'файл units_2026.csv и snake_case_name',
    );
  });
});

describe('excerpt', () => {
  it('keeps short text as is', () => {
    expect(excerpt('Короткий текст', 50)).toBe('Короткий текст');
  });

  it('cuts at a word boundary and adds an ellipsis', () => {
    expect(excerpt('Собрание собственников пройдёт в субботу во дворе', 30)).toBe(
      'Собрание собственников…',
    );
  });
});
