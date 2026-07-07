"""
Fase 4 — Proveedor LLM compartido (Gemini / Groq / OpenAI).

Centraliza la plomería que antes vivía duplicada en attendance/router.ai_insights.
Tanto el análisis de inasistencias como el Copiloto usan `responder()`.
"""
import os
from typing import List, Dict, Optional

MODELO_GEMINI = "gemini-2.5-flash"


def hay_llm_configurado() -> bool:
    return bool(os.getenv("GEMINI_API_KEY") or os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY"))


def responder(
    system_prompt: str,
    messages: List[Dict[str, str]],
    prompt_inicial: str = "Genera un análisis general.",
    temperatura: float = 0.2,
) -> str:
    """
    Envía la conversación al proveedor disponible y devuelve el texto de respuesta.
    `messages` es una lista de {role: 'user'|'assistant', content: str}.
    Devuelve un texto de error legible si algo falla (no lanza excepción).
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    openai_key = os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY")

    if not gemini_key and not openai_key:
        return "La API key de IA no está configurada en el backend (define GEMINI_API_KEY, GROQ_API_KEY u OPENAI_API_KEY)."

    try:
        if gemini_key:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel(
                model_name=MODELO_GEMINI,
                system_instruction=system_prompt,
                generation_config={"temperature": temperatura},
            )
            history = []
            for m in messages:
                history.append({
                    "role": "model" if m["role"] == "assistant" else "user",
                    "parts": [m["content"]],
                })
            if not history:
                return model.generate_content(prompt_inicial).text
            chat = model.start_chat(history=history[:-1])
            return chat.send_message(history[-1]["parts"][0]).text

        # Groq (compatible OpenAI) u OpenAI
        from openai import OpenAI
        usa_groq = bool(os.getenv("GROQ_API_KEY"))
        base_url = "https://api.groq.com/openai/v1" if usa_groq else None
        modelo = "llama3-8b-8192" if usa_groq else "gpt-3.5-turbo"
        client = OpenAI(api_key=openai_key, base_url=base_url)

        chat_msgs = [{"role": "system", "content": system_prompt}]
        for m in messages:
            chat_msgs.append({"role": m["role"], "content": m["content"]})
        if not messages:
            chat_msgs.append({"role": "user", "content": prompt_inicial})

        resp = client.chat.completions.create(model=modelo, messages=chat_msgs, temperature=temperatura)
        return resp.choices[0].message.content
    except Exception as e:  # noqa: BLE001 — degradar con gracia
        print(f"Error LLM: {e}")
        return f"Ocurrió un error al generar la respuesta de IA: {str(e)}"
