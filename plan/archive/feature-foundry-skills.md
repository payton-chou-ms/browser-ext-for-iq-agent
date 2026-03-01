# Foundry Skills/Tools 規劃（取代舊版命名）

> Last Updated: 2026-02-27  
> Status: Active (Terminology Aligned)

## 說明

此文件用來取代舊版整合命名，
統一改為目前產品採用的 **Skills/Tools 流程**。

現行方向：

- Browser UI 不支援舊版模式
- Foundry 功能以 Skills/Tools 方式呈現與執行
- UI 重點為工具呼叫可視化、執行狀態與結果摘要

## 現行能力（MVP）

- Skills 面板可顯示 Foundry 相關 skills
- 可從 Browser UI 觸發 skill 執行
- proxy 可回傳 mock/實際執行結果
- chat 區顯示 summary 與 output

## 後續規劃

1. 將 Foundry skill 執行從 mock 切換到實際 API
2. 強化 Tool 卡片：耗時、錯誤分類、重試
3. 補齊對話歷史中的 Skills/Tools 執行追蹤

## 參考文件

- `README.md`：產品對外說明與限制
- `architecture.md`：現行架構與模組職責

## 備註

保留原檔名只為了相容既有連結；
內容已完成 terminology cleanup，不再使用舊版模式設計語彙。
