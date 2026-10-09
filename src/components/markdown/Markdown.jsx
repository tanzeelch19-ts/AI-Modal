import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './Codeblock.jsx';
import { focusRing, scrollbar } from '../../lib/Styles.js';
import { cn } from '../../lib/Utils.js';

// Makes a markdown element (p, ul, ...) that carries Tailwind classes.
const el = (Tag, cls) =>
  function MarkdownElement({ node, className, ...props }) {
    return <Tag {...props} className={cn(cls, className)} />;
  };
 
const heading = 'mt-[1em] mb-[.4em] text-[1.1rem] font-bold';
 
// Inline `code` gets a background; code inside <pre> (CodeBlock) does not.
const inlineCode = '[:not(pre)>&]:rounded-[4px] [:not(pre)>&]:bg-panel [:not(pre)>&]:px-[5px] [:not(pre)>&]:py-px [:not(pre)>&]:text-[.9em]';
 
const components = {
  pre: CodeBlock,
  code: el('code', cn('font-mono', inlineCode)),
  p: el('p', 'mb-[.7em] last:mb-0'),
  h1: el('h1', heading),
  h2: el('h2', heading),
  h3: el('h3', heading),
  h4: el('h4', 'mt-[1em] mb-[.4em] font-bold'),
  h5: el('h5', 'mt-[1em] mb-[.4em] font-bold'),
  h6: el('h6', 'mt-[1em] mb-[.4em] font-bold'),
  ul: el('ul', 'mb-[.7em] list-disc pl-[1.4em]'),
  ol: el('ol', 'mb-[.7em] list-decimal pl-[1.4em]'),
  a: el('a', cn('text-acc underline', focusRing)),
  blockquote: el('blockquote', 'my-[.7em] border-l-2 border-line pl-3 text-mute'),
  hr: el('hr', 'my-4 border-line'),
  table: el('table', cn('my-[.6em] block overflow-x-auto border-collapse', scrollbar)),
  th: el('th', 'border border-line bg-panel px-2.5 py-F1.5 text-left'),
  td: el('td', 'border border-line px-2.5 py-1.5 text-left'),
};
 
const plugins = [remarkGfm];

export default memo(function Markdown({ children }) {
  return <ReactMarkdown remarkPlugins={plugins} components={components}>{children}</ReactMarkdown>;
});