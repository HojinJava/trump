# src/analysis/claude_analyzer.py
import os
import json
from typing import Dict, List
import anthropic
from dotenv import load_dotenv

load_dotenv('config.txt')

_client = None

def _get_client():
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.environ['ANTHROPIC_API_KEY'])
    return _client


ANALYSIS_PROMPT = """Analyze this Trump speech transcript and return ONLY valid JSON with no other text.

{{
  "rage": <integer 0-100. 0=calm/diplomatic, 100=explosive/extremely aggressive. Base on emotional language intensity, use of ALL CAPS words, exclamation patterns, attack words like "disaster", "destroy", "kill", "evil", "terrible">,
  "primary_target": "<main entity attacked or praised — person, country, institution, or null>",
  "targets": ["<list of all named entities attacked or criticized>"],
  "trade_war_signal": <integer 0-100. How strongly does this signal trade aggression: tariffs, sanctions, trade war, economic decoupling. 0=no mention, 100=explicit tariff announcement>,
  "market_brag": <integer 0-100. How much does Trump claim credit for economy/markets: "greatest economy", "stock market at record", "I built this". 0=no mention, 100=entire speech is market self-praise>,
  "keywords": ["<5 most important theme keywords>"],
  "minute_summaries": [
    {{"minute": 0, "summary": "<one sentence, max 80 chars>"}},
    ...one entry per minute of speech...
  ]
}}

Transcript:
{transcript}"""


def analyze(full_transcript: str, duration_minutes: int) -> Dict:
    """전체 발언 텍스트 분석 → 서브지수 + 요약 반환"""
    prompt = ANALYSIS_PROMPT.format(transcript=full_transcript[:8000])

    message = _get_client().messages.create(
        model='claude-sonnet-4-6',
        max_tokens=2000,
        messages=[{'role': 'user', 'content': prompt}]
    )

    raw = message.content[0].text.strip()
    if '```' in raw:
        raw = raw.split('```')[1]
        if raw.startswith('json'):
            raw = raw[4:]

    result = json.loads(raw)
    result['trump_risk_score'] = None
    return result
