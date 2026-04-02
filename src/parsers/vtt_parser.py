import re
from typing import List, Dict


def parse_vtt(content: str) -> List[Dict]:
    """VTT 문자열을 파싱해 {offset_sec, text} 리스트 반환"""
    lines = content.split('\n')
    segments = []
    current_ts = None
    current_text = []

    for line in lines:
        ts_match = re.match(r'^(\d{2}:\d{2}:\d{2}[\.,]\d{3}) -->', line)
        if ts_match:
            if current_ts is not None and current_text:
                text = ' '.join(current_text).strip()
                if text:
                    segments.append({
                        'offset_sec': _ts_to_sec(current_ts),
                        'text': text
                    })
            current_ts = ts_match.group(1)
            current_text = []
        elif (line.strip()
              and not line.startswith('WEBVTT')
              and not line.startswith('Kind:')
              and not line.startswith('Language:')
              and '-->' not in line
              and not line.strip().isdigit()):
            clean = re.sub(r'<[^>]+>', '', line)
            clean = clean.replace('&gt;', '>').replace('&lt;', '<').replace('&amp;', '&').strip()
            if clean:
                current_text.append(clean)

    # Flush last segment
    if current_ts is not None and current_text:
        text = ' '.join(current_text).strip()
        if text:
            segments.append({'offset_sec': _ts_to_sec(current_ts), 'text': text})

    return segments


def deduplicate_segments(segments: List[Dict]) -> List[Dict]:
    """연속된 동일 텍스트 제거"""
    result = []
    prev_text = None
    for seg in segments:
        if seg['text'] != prev_text:
            result.append(seg)
            prev_text = seg['text']
    return result


def _ts_to_sec(ts: str) -> float:
    ts = ts.replace(',', '.')
    h, m, s = ts.split(':')
    return int(h) * 3600 + int(m) * 60 + float(s)
