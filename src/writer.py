# src/writer.py
import json
import os
from typing import Dict

DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data.json')


def load_data() -> Dict:
    if not os.path.exists(DATA_FILE):
        return {'events': []}
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_event(event: Dict) -> None:
    """이벤트를 data.json에 저장. 같은 id면 덮어씀."""
    data = load_data()
    existing = [e for e in data['events'] if e['id'] != event['id']]
    existing.append(event)
    existing.sort(key=lambda e: e.get('broadcast_at', ''), reverse=True)
    data['events'] = existing
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  data.json 저장 완료 (총 {len(existing)}개 이벤트)")
