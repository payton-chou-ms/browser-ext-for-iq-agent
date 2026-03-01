# Copilot SDK 關鍵限制回饋（Confirmed Unsupported）

更新日期：2026-03-01

本文件只列「官方文件已明確表示目前 Copilot SDK 不支援」的項目。
不包含可透過 hooks 或外部系統自行補上的能力。

## 1) BYOK 不支援企業身分鏈（Entra ID / OIDC / Managed Identity）

- 現況：BYOK 僅支援靜態憑證（API Key / static bearer token）。
- 已確認不支援：
  - Microsoft Entra ID（含 Managed Identity）原生流程
  - OIDC / SAML / 第三方 federated identity 原生流程
- 影響：企業若要求雲端原生無密碼身分（例如 MI），無法直接用 SDK 的 BYOK 原生完成。

## 2) Bearer Token 無自動刷新機制（無 callback）

- 現況：`bearerToken` 只接受靜態字串。
- 已確認不支援：SDK 端自動向宿主請求新 token 的機制。
- 影響：短效 token（如 Entra 1 小時）到期後，必須在應用層自行刷新並重建 session。

## 3) Session Resume 不會保存 Provider/API Keys

- 現況：session 可保存對話與部分狀態，但不保存 provider/API keys。
- 已確認不支援：恢復 session 時自動沿用既有 BYOK 憑證。
- 影響：resume 流程一定要重新注入憑證；無法做到「完全無感復原」。

## 4) GitHub Auth 模式下，無法跳過「每位使用者需有 Copilot entitlement」

- 現況：官方限制為 per-user entitlement 與 per-user rate limit。
- 已確認不支援：以單一共享授權覆蓋所有終端使用者（在 GitHub Auth 模式下）。
- 影響：企業上線前需先完成使用者授權盤點與配額規劃。

## 補充：以下不是「不支援」

- 權限控管、審批、審計：可用 `onPermissionRequest` / hooks 在應用層實作。
- 工具 allow/deny 與安全策略：可透過 callbacks 實作，非 SDK 缺失。
