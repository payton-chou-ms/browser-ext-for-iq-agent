#!/usr/bin/env python3
"""
Foundry Agent Skill CLI

獨立技能腳本，提供：
- health: 檢查 endpoint + credential
- list: 列出 agents
- invoke: 呼叫指定 agent
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


SCRIPT_DIR = Path(__file__).parent
SKILL_DIR = SCRIPT_DIR.parent
load_dotenv(SKILL_DIR / ".env")


try:
    from azure.ai.projects import AIProjectClient
    from azure.identity import DefaultAzureCredential
except Exception as exc:  # pragma: no cover
    print(f"❌ 缺少相依套件: {exc}", file=sys.stderr)
    print("請先安裝: pip install azure-ai-projects azure-identity python-dotenv", file=sys.stderr)
    sys.exit(1)


class FoundryClient:
    def __init__(self, endpoint: str) -> None:
        credential = DefaultAzureCredential()
        self._project_client = AIProjectClient(endpoint=endpoint, credential=credential)
        self._openai_client = self._project_client.get_openai_client()
        self._endpoint = endpoint

    def health(self) -> dict[str, Any]:
        try:
            _ = self.list_agents(limit=1)
            return {"ok": True, "endpoint": self._endpoint}
        except Exception as exc:
            return {"ok": False, "endpoint": self._endpoint, "error": str(exc)}

    def list_agents(self, limit: int = 50) -> list[dict[str, Any]]:
        agents_api = self._project_client.agents
        if not hasattr(agents_api, "list"):
            raise RuntimeError("目前 SDK 版本不支援 agents.list()")

        raw_agents = agents_api.list()
        agents: list[dict[str, Any]] = []

        for idx, item in enumerate(raw_agents):
            if idx >= limit:
                break

            if isinstance(item, dict):
                name = item.get("name")
                item_id = item.get("id")
                versions = item.get("versions")
            else:
                name = getattr(item, "name", None)
                item_id = getattr(item, "id", None)
                versions = getattr(item, "versions", None)

            agents.append(
                {
                    "name": name,
                    "id": item_id,
                    "has_versions": versions is not None,
                }
            )

        return agents

    def invoke(self, agent_name: str, message: str, session_id: str | None = None) -> dict[str, Any]:
        agent = self._project_client.agents.get(agent_name)
        versions = getattr(agent, "versions", None)

        if versions is None or "latest" not in versions:
            raise RuntimeError(f"Agent '{agent_name}' 找不到 latest version")

        definition = versions["latest"].definition
        model = definition.get("model")
        if not model:
            raise RuntimeError(f"Agent '{agent_name}' 的 definition 缺少 model")

        tools = self._serialize_tools(definition.get("tools", []))
        request_payload: dict[str, Any] = {
            "model": model,
            "instructions": definition.get("instructions", ""),
            "tools": tools,
            "input": message,
        }
        if session_id:
            request_payload["previous_response_id"] = session_id

        response = self._openai_client.responses.create(**request_payload)

        return {
            "agent_name": agent_name,
            "status": getattr(response, "status", "unknown"),
            "session_id": getattr(response, "id", session_id),
            "response_text": self._extract_text(response),
        }

    @staticmethod
    def _serialize_tools(tools: list[Any]) -> list[Any]:
        serialized: list[Any] = []
        for tool in tools:
            if isinstance(tool, dict):
                data = dict(tool)
            elif hasattr(tool, "as_dict"):
                data = tool.as_dict()
            else:
                data = tool

            if isinstance(data, dict):
                data["require_approval"] = "never"
            serialized.append(data)
        return serialized

    @staticmethod
    def _extract_text(response: Any) -> str:
        output = getattr(response, "output", [])
        for item in output:
            if getattr(item, "type", None) != "message":
                continue
            for content in getattr(item, "content", []):
                text = getattr(content, "text", None)
                if text:
                    return text
        return ""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Foundry Agent Skill CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    health_parser = subparsers.add_parser("health", help="檢查 endpoint + credential")
    health_parser.add_argument("--json", action="store_true", help="JSON 輸出")

    list_parser = subparsers.add_parser("list", help="列出 agents")
    list_parser.add_argument("--limit", type=int, default=50, help="最多列出幾個 agents")
    list_parser.add_argument("--json", action="store_true", help="JSON 輸出")

    invoke_parser = subparsers.add_parser("invoke", help="呼叫指定 agent")
    invoke_parser.add_argument("--agent-name", required=True, help="目標 agent 名稱")
    invoke_parser.add_argument("--message", required=True, help="輸入訊息")
    invoke_parser.add_argument("--session-id", default="", help="前一輪 response id")
    invoke_parser.add_argument("--json", action="store_true", help="JSON 輸出")

    return parser.parse_args()


def print_json(data: Any) -> None:
    print(json.dumps(data, ensure_ascii=False, indent=2))


def main() -> None:
    endpoint = os.getenv("AZURE_EXISTING_AIPROJECT_ENDPOINT", "").strip()
    if not endpoint:
        print("❌ 請設定 AZURE_EXISTING_AIPROJECT_ENDPOINT（可放在 .env）", file=sys.stderr)
        sys.exit(1)

    args = parse_args()
    client = FoundryClient(endpoint=endpoint)

    if args.command == "health":
        result = client.health()
        if args.json:
            print_json(result)
        else:
            print("✅ 可用" if result.get("ok") else "❌ 不可用")
            print(f"Endpoint: {result.get('endpoint')}")
            if result.get("error"):
                print(f"Error: {result.get('error')}")
        sys.exit(0 if result.get("ok") else 1)

    if args.command == "list":
        agents = client.list_agents(limit=args.limit)
        if args.json:
            print_json({"count": len(agents), "agents": agents})
        else:
            print(f"Found {len(agents)} agents")
            for idx, item in enumerate(agents, start=1):
                print(f"{idx:02d}. {item.get('name')} (id={item.get('id')})")
        return

    if args.command == "invoke":
        result = client.invoke(
            agent_name=args.agent_name,
            message=args.message,
            session_id=args.session_id or None,
        )
        if args.json:
            print_json(result)
        else:
            print(f"Agent: {result.get('agent_name')}")
            print(f"Status: {result.get('status')}")
            print(f"Session: {result.get('session_id')}")
            print("-" * 60)
            print(result.get("response_text", ""))
        return


def _entry() -> None:
    try:
        main()
    except KeyboardInterrupt:
        print("\n已中止")
        sys.exit(130)
    except Exception as exc:
        print(f"❌ 執行失敗: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    _entry()
