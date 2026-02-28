# Agent Instructions

> 本文件提供 AI 助手與開發者操作本專案時的指引。

## Project Overview

IQ Copilot 是一個 **Chrome 瀏覽器擴充功能**，整合 GitHub Copilot CLI 與企業內部工具（Work IQ、Microsoft Foundry），提供側欄 AI 助手體驗。

## Architecture Summary

```
Chrome Extension (MV3)
    ├── sidebar.html/js    # UI 層
    ├── background.js      # Service Worker (訊息路由)
    └── content_script.js  # 頁面上下文擷取
          ↓
    Local Proxy (proxy.ts)
          ↓
    @github/copilot-sdk
          ↓
    Copilot CLI
```

## Key Files

| Path | Purpose |
|------|---------|
| `src/sidebar.js` | Main UI controller |
| `src/background.js` | Extension service worker |
| `src/proxy.ts` | Local API gateway |
| `src/routes/*.ts` | Modular API routes |
| `src/lib/*.js` | Shared utilities |
| `src/lib/panels/*.js` | UI panel modules |

## Development Commands

```bash
# Start development
./start.sh

# Run tests
npm test

# Lint
npm run lint

# Build
npm run build
```

## Code Style Guidelines

### TypeScript/JavaScript
- Use ESM imports
- Prefer `const` over `let`
- Use async/await over callbacks
- Follow existing naming conventions (camelCase)

### File Organization
- Keep files focused and small (<500 lines)
- Group related functionality in `lib/panels/`
- Route handlers in `routes/`

## Testing Expectations

- Unit tests in `tests/unit/`
- E2E tests in `tests/`
- Maintain 80%+ coverage for new code

## Common Tasks

### Adding a New Panel
1. Create `src/lib/panels/new-panel.js`
2. Add panel button in `src/sidebar.html`
3. Register in `src/sidebar.js` panel system
4. Add i18n keys if needed

### Adding a New Route
1. Create handler in `src/routes/`
2. Register in `src/proxy.ts` router
3. Add Zod schema in `src/routes/schemas.ts`
4. Add unit tests

### Modifying Chat Behavior
- Streaming logic: `src/lib/chat-streaming.js`
- Tab management: `src/lib/chat-tabs.js`
- History: `src/lib/chat-session.js`

## Security Notes

- Never hardcode secrets
- Validate all user inputs with Zod schemas
- Use Content Security Policy in manifest.json
- CORS restricted to extension origin

## MCP Integration

See `mcp.json` for MCP server configuration.
The extension supports loading MCP tools from `~/.copilot/mcp-config.json`.

## Troubleshooting

### Proxy Connection Failed
1. Check if `./start.sh` is running
2. Verify port 8321 is available
3. Check Copilot CLI auth status

### Extension Not Loading
1. Verify manifest.json syntax
2. Check Chrome developer mode enabled
3. Look for errors in `chrome://extensions`

### Streaming Not Working
1. Check background.js console for errors
2. Verify SSE connection in Network tab
3. Ensure session is active
