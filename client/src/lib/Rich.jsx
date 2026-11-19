// Renders Hebrew text with inline LaTeX ($...$ / $$...$$) and **bold**.
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { memo } from 'react';

const cache = new Map();

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// KaTeX treats "|" as an ordinary symbol, so "|-7|" renders the minus as a binary
// operator ("| − 7|"). Make a minus right after an *opening* bar unary: "|{-}7|".
function fixAbsMinus(tex) {
  let out = '';
  let bars = 0;
  for (let i = 0; i < tex.length; i++) {
    const ch = tex[i];
    out += ch;
    if (ch === '|' && tex[i - 1] !== '\\') {
      bars += 1;
      if (bars % 2 === 1) {
        let j = i + 1;
        while (tex[j] === ' ') j++;
        if (tex[j] === '-') { out += '{-}'; i = j; }
      }
    }
  }
  return out;
}

export function renderRich(text) {
  if (text === null || text === undefined || text === '') return '';
  const key = String(text);
  if (cache.has(key)) return cache.get(key);
  const tokens = [];
  let s = key.replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g, (_m, block, inline) => {
    const tex = fixAbsMinus((block ?? inline).trim());
    let html;
    try {
      html = katex.renderToString(tex, { throwOnError: false, displayMode: block !== undefined, strict: 'ignore', output: 'html' });
    } catch {
      html = `<span class="math-ltr">${escapeHtml(tex)}</span>`;
    }
    tokens.push(html);
    return `\u0000${tokens.length - 1}\u0000`;
  });
  s = escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  // eslint-disable-next-line no-control-regex
  s = s.replace(/\u0000(\d+)\u0000/g, (_m, i) => tokens[Number(i)]);
  if (cache.size > 3000) cache.clear();
  cache.set(key, s);
  return s;
}

export const Rich = memo(function Rich({ text, as: Tag = 'span', className = '' }) {
  return <Tag className={`rich ${className}`} dangerouslySetInnerHTML={{ __html: renderRich(text) }} />;
});
