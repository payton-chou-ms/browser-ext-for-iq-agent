// Content script - injected into every matching webpage

function extractMainText() {
  const candidates = [
    "article",
    "main article",
    "main",
    "[role='main']",
    ".article-body",
    ".story-body",
    ".news-content",
    "#main-content",
  ];

  let root = null;
  for (const selector of candidates) {
    const found = document.querySelector(selector);
    if (found) {
      root = found;
      break;
    }
  }

  if (!root) root = document.body;
  if (!root) return "";

  const blocks = Array.from(root.querySelectorAll("p, h1, h2, h3, li"))
    .map((node) => (node.textContent || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((text) => text.length >= 20);

  const text = blocks.join("\n");
  if (text) return text.slice(0, 12000);

  return (root.innerText || "").replace(/\s+\n/g, "\n").trim().slice(0, 12000);
}

// Listen for messages from sidebar or background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_PAGE_TITLE") {
    sendResponse({ title: document.title, url: window.location.href });
  }

  if (message.type === "GET_PAGE_INFO") {
    // Detect PDF
    const isPdf =
      document.contentType === "application/pdf" ||
      window.location.href.endsWith(".pdf") ||
      !!document.querySelector('embed[type="application/pdf"]');

    // Extract meta tags
    const meta = {};
    document.querySelectorAll("meta[name], meta[property]").forEach((el) => {
      const key = el.getAttribute("name") || el.getAttribute("property");
      const val = el.getAttribute("content");
      if (key && val) meta[key] = val.substring(0, 200);
    });

    sendResponse({
      title: document.title,
      url: window.location.href,
      isPdf,
      meta,
      extractedText: extractMainText(),
    });
  }

  return true;
});
