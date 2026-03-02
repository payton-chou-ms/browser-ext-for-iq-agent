// ===== IQ Copilot — Format Worker (P2-13) =====
// Off-thread Markdown → HTML conversion.
// Mirrors formatText logic from utils.js but uses pure-string escapeHtml
// (Workers have no DOM access).

/* global self */
"use strict";

// ── Pure-string escapeHtml (no DOM) ──
const HTML_ESCAPE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const HTML_ESCAPE_RE = /[&<>"']/g;

function escapeHtml(str) {
  return String(str).replace(HTML_ESCAPE_RE, (ch) => HTML_ESCAPE_MAP[ch]);
}

// ── Inline markdown formatting ──
function formatInlineMarkdown(line) {
  if (!line) return "";

  const codeTokens = [];
  let parsed = line.replace(/`([^`\n]+)`/g, (_m, code) => {
    const token = `@@IQCODE${codeTokens.length}@@`;
    codeTokens.push(`<code>${code}</code>`);
    return token;
  });

  parsed = parsed
    // Images: ![alt](url) - must be before links to avoid conflict
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" class="chat-inline-image" style="max-width:100%;border-radius:8px;margin:8px 0;">')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>");

  codeTokens.forEach((tokenHtml, index) => {
    parsed = parsed.replace(`@@IQCODE${index}@@`, tokenHtml);
  });

  return parsed;
}

// ── Detect whether content is already HTML (has block-level tags) ──
const HTML_DETECT_RE = /<(?:p|div|ul|ol|li|h[1-6]|table|tr|td|th|blockquote|pre|br\s*\/?)(?:\s[^>]*)?>\s*/i;

/**
 * Sanitize HTML in Worker context (no DOM available).
 *
 * Uses an ALLOWLIST tokenizer instead of regex-based denylist.
 * Scans char-by-char, only emitting whitelisted tags with safe attributes.
 * This avoids incomplete multi-character sanitization and bad-regex issues
 * flagged by CodeQL (#8–#18).
 */
const SAFE_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "del",
  "code", "pre", "blockquote", "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "a", "img", "table", "thead", "tbody", "tr", "th", "td",
  "hr", "span", "div", "sup", "sub",
]);
const SAFE_ATTRS = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height", "style", "class"]),
  code: new Set(["class"]),
  pre: new Set(["class"]),
  span: new Set(["class", "style"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan"]),
};
const UNSAFE_SCHEME_RE = /^\s*(?:j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t|d\s*a\s*t\s*a)\s*:/i;

function sanitizeHtmlWorker(html) {
  const out = [];
  let i = 0;
  const len = html.length;

  while (i < len) {
    const ltIdx = html.indexOf("<", i);
    if (ltIdx === -1) {
      // No more tags — emit remaining text as-is
      out.push(html.slice(i));
      break;
    }
    // Emit text before the tag
    if (ltIdx > i) out.push(html.slice(i, ltIdx));

    // Find the end of this tag
    const gtIdx = html.indexOf(">", ltIdx);
    if (gtIdx === -1) {
      // Unterminated tag — emit as escaped text
      out.push(escapeHtml(html.slice(ltIdx)));
      break;
    }

    const fullTag = html.slice(ltIdx, gtIdx + 1);
    const inner = fullTag.slice(1, -1).trim(); // content between < and >

    // Skip comments and CDATA
    if (inner.startsWith("!") || inner.startsWith("?")) {
      i = gtIdx + 1;
      continue;
    }

    // Determine if closing tag
    const isClosing = inner.startsWith("/");
    const tagContent = isClosing ? inner.slice(1).trim() : inner;

    // Extract tag name (first word)
    const tagNameMatch = tagContent.match(/^([a-zA-Z][a-zA-Z0-9]*)/);
    if (!tagNameMatch) {
      // Not a valid tag — escape and emit
      out.push(escapeHtml(fullTag));
      i = gtIdx + 1;
      continue;
    }

    const tagName = tagNameMatch[1].toLowerCase();

    if (!SAFE_TAGS.has(tagName)) {
      // Disallowed tag — skip entirely (don't emit)
      i = gtIdx + 1;
      continue;
    }

    if (isClosing) {
      out.push(`</${tagName}>`);
      i = gtIdx + 1;
      continue;
    }

    // Self-closing check
    const isSelfClose = inner.endsWith("/") || tagName === "br" || tagName === "hr" || tagName === "img" || tagName === "embed";

    // Parse and filter attributes
    const attrsStr = tagContent.slice(tagNameMatch[0].length);
    const allowedSet = SAFE_ATTRS[tagName] || new Set();
    const safeAttrs = [];
    const attrRe = /([a-zA-Z][\w-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
    let attrMatch;
    while ((attrMatch = attrRe.exec(attrsStr)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      const attrVal = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";
      if (!allowedSet.has(attrName)) continue;
      // Block dangerous URL schemes in href/src
      if ((attrName === "href" || attrName === "src") && UNSAFE_SCHEME_RE.test(attrVal)) continue;
      safeAttrs.push(`${attrName}="${attrVal}"`);
    }

    // Force safe attrs on <a> tags
    if (tagName === "a") {
      safeAttrs.push('target="_blank"', 'rel="noopener noreferrer"');
    }

    const attrStr = safeAttrs.length > 0 ? " " + safeAttrs.join(" ") : "";
    out.push(isSelfClose ? `<${tagName}${attrStr} />` : `<${tagName}${attrStr}>`);
    i = gtIdx + 1;
  }

  return out.join("");
}

// ── Block-level markdown → HTML ──
function formatText(text) {
  const raw = String(text ?? "");
  // If content is already HTML, sanitize and return directly
  if (HTML_DETECT_RE.test(raw)) {
    return sanitizeHtmlWorker(raw);
  }
  const safeText = escapeHtml(raw).replace(/\r\n?/g, "\n");
  const lines = safeText.split("\n");
  const html = [];

  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBlockLines = [];
  let inUnorderedList = false;
  let inOrderedList = false;
  let paragraphLines = [];
  let blockquoteLines = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    html.push(`<p>${paragraphLines.map((l) => formatInlineMarkdown(l)).join("<br>")}</p>`);
    paragraphLines = [];
  };

  const flushBlockquote = () => {
    if (blockquoteLines.length === 0) return;
    html.push(`<blockquote><p>${blockquoteLines.map((l) => formatInlineMarkdown(l)).join("<br>")}</p></blockquote>`);
    blockquoteLines = [];
  };

  const flushCodeBlock = () => {
    const languageClass = codeBlockLang ? ` class="language-${codeBlockLang}"` : "";
    html.push(`<pre><code${languageClass}>${codeBlockLines.join("\n")}</code></pre>`);
    codeBlockLines = [];
    codeBlockLang = "";
  };

  const closeLists = () => {
    if (inUnorderedList) { html.push("</ul>"); inUnorderedList = false; }
    if (inOrderedList)   { html.push("</ol>"); inOrderedList = false; }
  };

  const parseTableRow = (row) => {
    const normalized = row.trim().replace(/^\|/, "").replace(/\|$/, "");
    return normalized.split("|").map((cell) => cell.trim());
  };

  const isTableSeparator = (row) => {
    const normalized = row.trim().replace(/^\|/, "").replace(/\|$/, "");
    if (!normalized) return false;
    const cols = normalized.split("|").map((cell) => cell.trim());
    if (cols.length === 0) return false;
    return cols.every((cell) => /^:?-{3,}:?$/.test(cell));
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    const line = rawLine.trim();

    const codeFenceMatch = line.match(/^```(\w+)?\s*$/);
    if (codeFenceMatch) {
      flushParagraph(); flushBlockquote(); closeLists();
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = codeFenceMatch[1] || "";
        codeBlockLines = [];
      } else {
        flushCodeBlock();
        inCodeBlock = false;
      }
      continue;
    }

    if (inCodeBlock) { codeBlockLines.push(rawLine); continue; }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph(); flushBlockquote(); closeLists();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${formatInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushParagraph(); flushBlockquote(); closeLists();
      html.push("<hr>");
      continue;
    }

    const blockquoteMatch = rawLine.match(/^(?:>|&gt;)\s?(.*)$/);
    if (blockquoteMatch) {
      flushParagraph(); closeLists();
      blockquoteLines.push(blockquoteMatch[1]);
      continue;
    }

    flushBlockquote();

    const nextLine = lines[lineIndex + 1]?.trim() || "";
    const isTableHeader = line.includes("|") && isTableSeparator(nextLine);
    if (isTableHeader) {
      flushParagraph(); closeLists();
      const headerCells = parseTableRow(line);
      const bodyRows = [];
      lineIndex += 2;
      while (lineIndex < lines.length) {
        const tableLineTrimmed = lines[lineIndex].trim();
        if (!tableLineTrimmed || !tableLineTrimmed.includes("|")) { lineIndex -= 1; break; }
        bodyRows.push(parseTableRow(tableLineTrimmed));
        lineIndex += 1;
      }
      html.push("<table><thead><tr>");
      headerCells.forEach((cell) => { html.push(`<th>${formatInlineMarkdown(cell)}</th>`); });
      html.push("</tr></thead>");
      if (bodyRows.length > 0) {
        html.push("<tbody>");
        bodyRows.forEach((rowCells) => {
          html.push("<tr>");
          rowCells.forEach((cell) => { html.push(`<td>${formatInlineMarkdown(cell)}</td>`); });
          html.push("</tr>");
        });
        html.push("</tbody>");
      }
      html.push("</table>");
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);

    if (bulletMatch) {
      flushParagraph();
      if (inOrderedList) { html.push("</ol>"); inOrderedList = false; }
      if (!inUnorderedList) { html.push("<ul>"); inUnorderedList = true; }
      html.push(`<li>${formatInlineMarkdown(bulletMatch[1])}</li>`);
      continue;
    }

    if (orderedMatch) {
      flushParagraph();
      if (inUnorderedList) { html.push("</ul>"); inUnorderedList = false; }
      if (!inOrderedList) { html.push("<ol>"); inOrderedList = true; }
      html.push(`<li>${formatInlineMarkdown(orderedMatch[1])}</li>`);
      continue;
    }

    closeLists();

    if (!line) { flushParagraph(); continue; }
    paragraphLines.push(rawLine);
  }

  if (inCodeBlock) flushCodeBlock();
  flushBlockquote();
  flushParagraph();
  closeLists();

  return html.join("");
}

// ── Worker message handler ──
self.onmessage = function handleMessage(e) {
  const { id, content } = e.data;
  try {
    const html = formatText(content);
    self.postMessage({ id, html });
  } catch (err) {
    self.postMessage({ id, html: escapeHtml(String(content)), error: err.message });
  }
};
