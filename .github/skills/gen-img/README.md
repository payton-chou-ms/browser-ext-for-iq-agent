# gen-img (Quick Start)

最短路徑：用 Azure OpenAI 圖片模型產生圖片，並透過本機 `az login` 的身分進行驗證。

## 1) 安裝

```bash
cd .github/skills/gen-img
pip install -r requirements.txt
```

## 2) 設定環境

```bash
cd .github/skills/gen-img
cp .env.example .env
```

在 `.env` 填入：

```dotenv
AZURE_OPENAI_ENDPOINT=https://<your-resource>.openai.azure.com/
AZURE_OPENAI_IMAGE_MODEL=gpt-image-1
```

## 3) 使用

```bash
# 輸出到預設 output 目錄
python scripts/generate_image.py "一隻可愛的貓咪在草地上玩耍"

# 指定輸出檔案
python scripts/generate_image.py "商務簡報封面設計" -o ./output/cover.png
```

## 4) 注意事項

- 執行前需先完成 `az login`
- release 打包時不會包含 `.env`、`output/` 或任何本機快取內容
- 若使用 local_proxy 配套包，請先依 `requirements.txt` 建立 Python 環境