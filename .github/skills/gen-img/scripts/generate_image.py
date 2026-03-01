#!/usr/bin/env python3
"""
圖片生成工具 - 使用 Azure OpenAI 生成圖片

使用方式:
    python generate_image.py "圖片描述" [-o 輸出路徑] [-s 尺寸]
"""

import argparse
import base64
import os
import sys
from datetime import datetime
from pathlib import Path

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from dotenv import load_dotenv
from openai import OpenAI

# 載入 .env 檔案（從腳本目錄的上層）
script_dir = Path(__file__).parent
skill_dir = script_dir.parent
load_dotenv(skill_dir / ".env")


def main():
    parser = argparse.ArgumentParser(description="使用 Azure OpenAI 生成圖片")
    parser.add_argument("prompt", help="圖片生成的提示詞")
    parser.add_argument(
        "--output",
        "-o",
        default=None,
        help="輸出圖片的檔案路徑。預設為當前目錄下的 output/output_YYYYMMDD_HHMMSS.png",
    )

    args = parser.parse_args()

    # 從環境變數取得設定
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    model = os.environ.get("AZURE_OPENAI_IMAGE_MODEL", "gpt-image-1")
    size = "1536x1024"  # 固定尺寸

    if not endpoint:
        print(
            "錯誤：需要 Azure OpenAI 端點。請設定 AZURE_OPENAI_ENDPOINT 環境變數。",
            file=sys.stderr,
        )
        sys.exit(1)

    # 設定輸出檔名（預設為 output 資料夾）
    if args.output is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        args.output = f"./output/output_{timestamp}.png"

    # 確保輸出目錄存在
    output_path = Path(args.output)
    if output_path.parent != Path("."):
        output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        token_provider = get_bearer_token_provider(
            DefaultAzureCredential(),
            "https://cognitiveservices.azure.com/.default",
        )

        client = OpenAI(
            base_url=f"{endpoint.rstrip('/')}/openai/v1/",
            api_key=token_provider,
        )

        print(f"正在生成圖片: {args.prompt}")
        print(f"尺寸: {size}")
        print(f"模型: {model}")

        img = client.images.generate(
            model=model,
            prompt=args.prompt,
            n=1,
            size=size,
        )

        # Get base64 image data
        b64_json = img.data[0].b64_json
        image_bytes = base64.b64decode(b64_json)
        
        # Save to file
        with open(args.output, "wb") as f:
            f.write(image_bytes)

        # Get absolute path for the output file
        abs_path = Path(args.output).resolve()
        
        print(f"✅ 圖片已儲存至: {abs_path}")
        
        # Output markdown image with proxy URL
        # The proxy serves images from output directory via /api/image?path=
        from urllib.parse import quote
        proxy_url = f"http://127.0.0.1:8321/api/image?path={quote(str(abs_path))}"
        print(f"\n![Generated Image]({proxy_url})")

    except Exception as e:
        print(f"❌ 錯誤: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
