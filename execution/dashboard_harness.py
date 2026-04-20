"""
Harness CLI para disparar simulações de fluxo na dashboard.

Uso:
  python execution/dashboard_harness.py --client-id 0 --scenario success
"""

from __future__ import annotations

import argparse
import os

import requests


def main() -> None:
    parser = argparse.ArgumentParser(description="Harness de simulação para dashboard viva.")
    parser.add_argument("--client-id", type=int, required=True, help="ID numérico do cliente na dashboard")
    parser.add_argument(
        "--scenario",
        default="success",
        choices=["success", "send_fail", "route_fail"],
        help="Cenário da simulação",
    )
    parser.add_argument(
        "--base-url",
        default=os.getenv("DASHBOARD_BASE_URL", "http://127.0.0.1:8091"),
        help="URL base da dashboard",
    )
    args = parser.parse_args()

    url = f"{args.base_url.rstrip('/')}/api/harness/simulate-webhook"
    response = requests.post(
        url,
        json={"client_id": args.client_id, "scenario": args.scenario},
        timeout=15,
    )
    response.raise_for_status()
    data = response.json()
    if not data.get("ok"):
        raise SystemExit(f"Harness falhou: {data}")
    print(f"Harness iniciado: cliente={data.get('client_name')} scenario={data.get('scenario')}")


if __name__ == "__main__":
    main()
