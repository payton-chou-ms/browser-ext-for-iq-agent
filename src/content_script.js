// Content script - injected into every matching webpage

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
    });
  }

  return true;
});
