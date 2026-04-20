"""
Gerenciamento de templates de mensagem com variáveis.
"""

from __future__ import annotations

import json
import os
import re
from copy import deepcopy
from typing import Any, Dict

_VAR_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")

DEFAULT_TEMPLATES: Dict[str, Dict[str, Dict[str, str]]] = {
    "meta_lead": {
        "default": {
            "name": "Meta Lead - Padrão",
            "description": "Mensagem padrão de novo lead para WhatsApp.",
            "content": (
                "Novo lead - {{client_name}}\n"
                "Nome do Lead: {{nome}}\n"
                "WhatsApp do Lead: {{whatsapp}}\n"
                "E-mail do Lead: {{email}}\n\n"
                "==========\n\n"
                "Respostas do Lead:\n"
                "{{respostas}}"
            ),
        },
        "pratical_life": {
            "name": "Meta Lead - Pratical Life",
            "description": "Formato detalhado usado para Pratical Life.",
            "content": (
                "Novo lead recebido - {{client_name}}\n"
                "Contato:\n"
                "- Nome: {{nome}}\n"
                "- WhatsApp: {{whatsapp}}\n"
                "- E-mail: {{email}}\n"
                "- Nome do formulario: {{form_name}}\n\n"
                "Formulario:\n"
                "{{respostas}}"
            ),
        },
        "lorena": {
            "name": "Meta Lead - Lorena",
            "description": "Template legado para Lorena (usa conteúdo padrão).",
            "content": (
                "Novo lead - {{client_name}}\n"
                "Nome do Lead: {{nome}}\n"
                "WhatsApp do Lead: {{whatsapp}}\n"
                "E-mail do Lead: {{email}}\n\n"
                "==========\n\n"
                "Respostas do Lead:\n"
                "{{respostas}}"
            ),
        },
    },
    "google_report": {
        "default": {
            "name": "Google Report - Padrão",
            "description": "Template padrão para relatório Google Ads.",
            "content": (
                "*{{client_name}}*\n\n"
                "📊 *Relatorio Google Ads*\n"
                "🆔 *Conta:* {{customer_id}}\n"
                "📅 *Periodo (7 dias):* {{period_start_br}} a {{period_end_br}}\n\n"
                "🎯 *Conversoes primarias:*\n"
                "{{conversions_block}}\n\n"
                "📌 *Campanhas ativas (metricas por campanha):*\n"
                "{{campaigns_block}}"
            ),
        }
    },
}

TEMPLATE_VARIABLES: Dict[str, Dict[str, str]] = {
    "meta_lead": {
        "client_name": "Nome do cliente",
        "nome": "Nome do lead",
        "email": "Email do lead",
        "whatsapp": "Link/contato WhatsApp",
        "form_name": "Nome do formulário",
        "respostas": "Bloco com respostas adicionais",
    },
    "google_report": {
        "client_name": "Nome do cliente",
        "customer_id": "ID formatado da conta Google Ads",
        "period_start_br": "Data início em DD/MM/AAAA",
        "period_end_br": "Data fim em DD/MM/AAAA",
        "conversions_block": "Lista formatada de conversões",
        "campaigns_block": "Lista formatada de campanhas",
    },
}


def _templates_path() -> str:
    return os.path.join(os.path.dirname(__file__), "..", "message_templates.json")


def _deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    out = deepcopy(base)
    for key, value in override.items():
        if key in out and isinstance(out[key], dict) and isinstance(value, dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = deepcopy(value)
    return out


def load_templates() -> Dict[str, Dict[str, Dict[str, str]]]:
    path = _templates_path()
    if not os.path.exists(path):
        return deepcopy(DEFAULT_TEMPLATES)
    try:
        with open(path, "r", encoding="utf-8") as f:
            raw = json.load(f)
    except (OSError, json.JSONDecodeError):
        return deepcopy(DEFAULT_TEMPLATES)
    if not isinstance(raw, dict):
        return deepcopy(DEFAULT_TEMPLATES)
    return _deep_merge(DEFAULT_TEMPLATES, raw)


def save_templates(data: Dict[str, Dict[str, Dict[str, str]]]) -> None:
    path = _templates_path()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def list_templates_payload() -> Dict[str, Any]:
    return {
        "channels": load_templates(),
        "variables": TEMPLATE_VARIABLES,
    }


def upsert_template(channel: str, template_id: str, *, name: str, content: str, description: str = "") -> Dict[str, Any]:
    channel = (channel or "").strip()
    template_id = (template_id or "").strip()
    if not channel:
        raise ValueError("channel_obrigatorio")
    if not template_id:
        raise ValueError("template_id_obrigatorio")
    if not content.strip():
        raise ValueError("content_obrigatorio")
    templates = load_templates()
    channel_bucket = templates.setdefault(channel, {})
    channel_bucket[template_id] = {
        "name": (name or template_id).strip(),
        "description": (description or "").strip(),
        "content": content,
    }
    save_templates(templates)
    return channel_bucket[template_id]


def render_template_text(content: str, context: Dict[str, Any]) -> str:
    def repl(match: re.Match[str]) -> str:
        key = match.group(1)
        value = context.get(key, "")
        if value is None:
            return ""
        return str(value)

    return _VAR_RE.sub(repl, content or "")


def get_template_content(channel: str, template_id: str) -> str:
    templates = load_templates()
    data = templates.get(channel, {}).get(template_id, {})
    if isinstance(data, dict):
        return str(data.get("content", "")).strip()
    return ""
