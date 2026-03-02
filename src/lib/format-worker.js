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
 * Sanitize HTML in Worker context (no DOM — use regex allowlist).
 * Uses loop-until-stable to prevent nested bypass (#8-#11).
 * Strips dangerous tags/attributes, keeps safe formatting.
 */
function sanitizeHtmlWorker(html) {
  let safe = html;

  // Loop until no more dangerous patterns are found (prevents nested bypass)
  let prev;
  do {
    prev = safe;
    // Remove dangerous elements
    safe = safe
      .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
      .replace(/<style[\s\S]*?<\/style\s*>/gi, "")
      .replace(/<iframe[\s\S]*?<\/iframe\s*>/gi, "")
      .replace(/<object[\s\S]*?<\/object\s*>/gi, "")
      .replace(/<embed[^>]*\/?>/gi, "")
      .replace(/<form[\s\S]*?<\/form\s*>/gi, "")
      .replace(/<input[^>]*\/?>/gi, "")
      .replace(/<svg[\s\S]*?<\/svg\s*>/gi, "");
    // Remove orphaned opening tags for dangerous elements
    safe = safe.replace(/<(?:script|style|iframe|object|embed|form|input|svg)\b[^>]*>/gi, "");
    // Remove on* event attributes (loop handles re-formed patterns)
    safe = safe.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  } while (safe !== prev);

  // Remove dangerous URL schemes (handles whitespace/entity obfuscation)
  safe = safe.replace(
    /(href|src)\s*=\s*(["'])\s*(?:\s*(?:&#\d+;|&#x[0-9a-f]+;)?)*j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/gi,
    '$1=$2'
  );
  safe = safe.replace(
    /(href|src)\s*=\s*(["'])\s*(?:\s*(?:&#\d+;|&#x[0-9a-f]+;)?)*d\s*a\s*t\s*a\s*:/gi,
    '$1=$2'
  );

  // Force target="_blank" rel="noopener noreferrer" on <a> tags
  safe = safe.replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ');
  return safe;
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
