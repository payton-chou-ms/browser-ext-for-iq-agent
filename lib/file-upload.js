(function initIQFileUpload(global) {
  const root = global.IQ || (global.IQ = {});
  const CONFIG = root.state?.CONFIG || {};
  const utils = root.utils || {};

  let pendingFiles = [];

  const MAX_FILE_SIZE = CONFIG.MAX_FILE_SIZE_BYTES || 10 * 1024 * 1024;
  const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];
  const TEXT_EXTENSIONS = [".txt", ".md", ".json", ".js", ".ts", ".jsx", ".tsx", ".py", ".html", ".css", ".csv", ".xml", ".yaml", ".yml", ".toml", ".sh", ".bash", ".log"];

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }

  function isImageFile(file) {
    return IMAGE_TYPES.includes(file.type) || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name);
  }

  function isTextFile(file) {
    const ext = "." + file.name.split(".").pop().toLowerCase();
    return TEXT_EXTENSIONS.includes(ext) || file.type.startsWith("text/");
  }

  function getFileIcon(file) {
    if (isImageFile(file)) return "🖼️";
    const ext = file.name.split(".").pop().toLowerCase();
    const icons = {
      pdf: "📕", json: "📋", md: "📝", txt: "📄", csv: "📊",
      js: "💛", ts: "💙", jsx: "⚛️", tsx: "⚛️", py: "🐍",
      html: "🌐", css: "🎨", xml: "📰", yaml: "⚙️", yml: "⚙️",
      sh: "💻", bash: "💻", log: "📋", toml: "⚙️",
    };
    return icons[ext] || "📎";
  }

  async function addFiles(fileList) {
    const escapeHtml = utils.escapeHtml || ((s) => s);
    const formatFileSize = utils.formatFileSize || ((b) => b + " B");
    const showToast = utils.showToast || (() => {});

    for (const file of fileList) {
      if (file.size > MAX_FILE_SIZE) {
        showToast(`${file.name} 超過 10MB 限制`);
        continue;
      }
      if (pendingFiles.some((f) => f.name === file.name && f.size === file.size)) {
        continue;
      }

      try {
        let dataUrl = null;
        let textContent = null;

        if (isImageFile(file)) {
          dataUrl = await readFileAsDataUrl(file);
        } else if (isTextFile(file) || file.type === "application/json") {
          textContent = await readFileAsText(file);
          dataUrl = await readFileAsDataUrl(file);
        } else {
          dataUrl = await readFileAsDataUrl(file);
        }

        pendingFiles.push({
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataUrl,
          textContent,
          isImage: isImageFile(file),
        });
      } catch (err) {
        showToast(`讀取 ${file.name} 失敗: ${err.message}`);
      }
    }
    renderFilePreview();
  }

  function removePendingFile(index) {
    pendingFiles.splice(index, 1);
    renderFilePreview();
  }

  function clearPendingFiles() {
    pendingFiles.length = 0;
    renderFilePreview();
  }

  function getPendingFiles() {
    return [...pendingFiles];
  }

  function renderFilePreview() {
    const filePreviewBar = document.getElementById("file-preview-bar");
    const escapeHtml = utils.escapeHtml || ((s) => s);
    const formatFileSize = utils.formatFileSize || ((b) => b + " B");
    if (!filePreviewBar) return;
    if (pendingFiles.length === 0) {
      filePreviewBar.style.display = "none";
      filePreviewBar.innerHTML = "";
      return;
    }

    filePreviewBar.style.display = "flex";
    filePreviewBar.innerHTML = pendingFiles.map((f, i) => {
      const icon = getFileIcon(f);
      const preview = f.isImage && f.dataUrl
        ? `<img src="${f.dataUrl}" class="file-chip-thumb" alt="${escapeHtml(f.name)}">`
        : `<span class="file-chip-icon">${icon}</span>`;
      return `<div class="file-chip" data-index="${i}">
        ${preview}
        <span class="file-chip-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        <span class="file-chip-size">${formatFileSize(f.size)}</span>
        <button class="file-chip-remove" data-index="${i}" title="移除">✕</button>
      </div>`;
    }).join("");

    filePreviewBar.querySelectorAll(".file-chip-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        removePendingFile(parseInt(btn.dataset.index, 10));
      });
    });
  }

  function addUserMessageWithFiles(text, files) {
    const chat = root.chat || {};
    const escapeHtml = utils.escapeHtml || ((s) => s);
    const formatFileSize = utils.formatFileSize || ((b) => b + " B");
    const chatMessages = document.getElementById("chat-messages");
    const chatState = chat.getState?.() || {};

    const msg = chat.createMessage?.("user", text || "");
    if (!msg) return;
    const bubble = msg.querySelector(".msg-bubble");

    if (files.length > 0) {
      const filesDiv = document.createElement("div");
      filesDiv.className = "msg-files";
      filesDiv.innerHTML = files.map((f) => {
        if (f.isImage && f.dataUrl) {
          return `<div class="msg-file-item msg-file-image">
            <img src="${f.dataUrl}" alt="${escapeHtml(f.name)}" class="msg-file-img">
            <span class="msg-file-name">${escapeHtml(f.name)}</span>
          </div>`;
        }
        const icon = getFileIcon(f);
        return `<div class="msg-file-item">
          <span class="msg-file-icon">${icon}</span>
          <span class="msg-file-name">${escapeHtml(f.name)}</span>
          <span class="msg-file-size">${formatFileSize(f.size)}</span>
        </div>`;
      }).join("");
      bubble.prepend(filesDiv);
    }

    if (chatMessages) chatMessages.appendChild(msg);
    chat.pushChatHistory?.({ role: "user", content: text, files: files.map((f) => ({ name: f.name, type: f.type, size: f.size })) });
    utils.trimContainerChildren?.(chatMessages, CONFIG.MAX_CHAT_HISTORY_ENTRIES || 200);
    const state = chat.getState?.() || {};
    if (state.stats) state.stats.messages++;
    root.panels?.usage?.updateStats?.();
    utils.scrollToBottom?.();
    chat.hideSuggestions?.();
  }

  function bindEvents() {
    const fileInput = document.getElementById("file-input");
    const btnAttach = document.getElementById("btn-attach");
    const chatInput = document.getElementById("chat-input");

    btnAttach?.addEventListener("click", () => fileInput?.click());

    fileInput?.addEventListener("change", () => {
      if (fileInput.files.length > 0) {
        addFiles(fileInput.files);
        fileInput.value = "";
      }
    });

    const chatInputArea = document.querySelector(".chat-input-area");
    if (chatInputArea) {
      chatInputArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
        chatInputArea.classList.add("drag-over");
      });
      chatInputArea.addEventListener("dragleave", (e) => {
        e.preventDefault();
        e.stopPropagation();
        chatInputArea.classList.remove("drag-over");
      });
      chatInputArea.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        chatInputArea.classList.remove("drag-over");
        if (e.dataTransfer?.files?.length > 0) {
          addFiles(e.dataTransfer.files);
        }
      });
    }

    if (chatInput) {
      chatInput.addEventListener("paste", (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        const files = [];
        for (const item of items) {
          if (item.kind === "file") {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }
        if (files.length > 0) {
          e.preventDefault();
          addFiles(files);
        }
      });
    }
  }

  root.fileUpload = {
    getPendingFiles,
    clearPendingFiles,
    addFiles,
    addUserMessageWithFiles,
    getFileIcon,
    isImageFile,
    isTextFile,
    bindEvents,
  };
})(window);
