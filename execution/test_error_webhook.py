"""
Envia dois POSTs de teste ao webhook (payload meta_token_expirado e erro_automacao).

Uso na raiz do repositório:
  python execution/test_error_webhook.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from execution.webhook_notify import notify_erro_automacao, notify_meta_token_expirado


def main() -> None:
    from execution.webhook_notify import get_error_webhook_url

    url = get_error_webhook_url()
    print(f"Webhook URL: {url}")

    code1 = notify_meta_token_expirado(
        "TESTE MANUAL: simulação de expiração do META_ACCESS_TOKEN. "
        "Se você recebeu isto no n8n, o evento meta_token_expirado está correto.",
        meta_error_code=190,
        meta_error_subcode=463,
        cliente=None,
        fbtrace_id="test_trace",
    )
    print(f"meta_token_expirado: HTTP {code1!r}")

    code2 = notify_erro_automacao(
        "TESTE MANUAL: simulação de erro genérico da automação. "
        "Se você recebeu isto no n8n, o evento erro_automacao está correto.",
        tipo_excecao="RuntimeError",
        mensagem="Mensagem de teste — pode ignorar.",
        cliente=None,
    )
    print(f"erro_automacao: HTTP {code2!r}")


if __name__ == "__main__":
    main()
