import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Markdown без HTML (ТЗ п. 4.16): HTML-теги из текста отбрасываются, картинки не загружаются,
 * опасные ссылки (javascript: и т. п.) react-markdown убирает сам. Внешние ссылки — в новой вкладке.
 */
export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`markdown ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        disallowedElements={['img']}
        unwrapDisallowed
        components={{
          a: ({ node: _node, href, ...props }) =>
            href && /^https?:/.test(href) ? (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow" {...props} />
            ) : (
              <a href={href} {...props} />
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
