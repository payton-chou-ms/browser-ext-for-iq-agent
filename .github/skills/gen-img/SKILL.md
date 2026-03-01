---
name: gen-img
description: '使用 Azure OpenAI 生成圖片。'
---

# 圖片生成器

此技能使用 Azure OpenAI 的圖片生成模型根據文字描述生成圖片，並透過 Microsoft Entra ID（RBAC）進行驗證。

## 功能特色

- ✅ 使用 Azure OpenAI 生成高品質圖片
- ✅ 固定輸出 1536x1024 橫向圖片
- ✅ 自動命名輸出檔案（含時間戳記）

## 使用方式

```bash
# 基本使用（輸出到當前目錄）
python scripts/generate_image.py "一隻可愛的貓咪在草地上玩耍"

# 指定輸出路徑
python scripts/generate_image.py "一隻可愛的貓咪" -o ./output/cat.png
```

### 參數說明

| 參數 | 簡寫 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| `prompt` | - | ✅ | - | 圖片生成的文字描述 |
| `--output` | `-o` | ❌ | `./output/output_YYYYMMDD_HHMMSS.png` | 輸出圖片路徑 |

## 環境設定

| 變數名稱 | 說明 |
|----------|------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI 服務端點 |
| `AZURE_OPENAI_IMAGE_MODEL` | 圖片生成模型名稱 |

> 需先完成 `az login`，並確認目前身分在目標 Azure OpenAI 資源具備可呼叫模型的 RBAC 權限。

## 輸出範例

```
正在生成圖片: 一隻可愛的貓咪在草地上玩耍
尺寸: 1536x1024
模型: gpt-image-1.5
✅ 圖片已儲存至: ./output/output_20260125_143052.png

![Generated Image](http://127.0.0.1:8321/api/image?path=...)
```

## 重要：回應格式

執行完成後，腳本會輸出一個 Markdown 格式的圖片連結：
```
![Generated Image](http://127.0.0.1:8321/api/image?path=/path/to/image.png)
```

**你必須在回應中直接包含這個 Markdown 圖片連結，讓用戶可以看到生成的圖片。**
不要只回報檔案路徑，要把完整的 `![Generated Image](...)` 這行原封不動地放在你的回覆中。
