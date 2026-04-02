# src/parsers/youtube_live.py
import subprocess
import json
import tempfile
import os
from datetime import datetime, timezone, timedelta
from typing import Dict, List

from src.parsers.vtt_parser import parse_vtt, deduplicate_segments

SPEECH_START_KEYWORDS = [
    'my fellow americans',
    'thank you very much, my fellow',
    'good evening, my fellow',
    'my fellow citizens',
]

SPEECH_END_KEYWORDS = [
    'god bless the united states of america',
    'good night',
    'thank you very much and good night',
]


def collect(url: str) -> Dict:
    """YouTube 라이브 영상 수집. 반환: 이벤트 dict"""
    print(f"[1/4] 메타데이터 추출 중...")
    meta = _get_metadata(url)

    print(f"[2/4] 자막 추출 중...")
    vtt_content = _get_subtitles(url, meta['id'])

    print(f"[3/4] 세그먼트 파싱 중...")
    segments = deduplicate_segments(parse_vtt(vtt_content))
    speech_start, speech_end = _detect_speech_bounds(segments)
    speech_segments = [s for s in segments
                       if speech_start <= s['offset_sec'] <= speech_end]

    print(f"    발언 감지: {_fmt_sec(speech_start)} ~ {_fmt_sec(speech_end)}")

    # 실시간 UTC 계산
    release_ts = meta['release_timestamp']
    for seg in speech_segments:
        real_dt = datetime.fromtimestamp(release_ts + seg['offset_sec'], tz=timezone.utc)
        seg['real_time'] = real_dt.isoformat()
        seg['youtube_url'] = f"https://youtube.com/watch?v={meta['id']}&t={int(seg['offset_sec'])}"

    broadcast_at = datetime.fromtimestamp(
        release_ts + speech_start, tz=timezone.utc
    ).isoformat()

    return {
        'id': meta['id'],
        'source': 'youtube_live',
        'url': url,
        'title': meta['title'],
        'broadcast_at': broadcast_at,
        'speech_start_offset': int(speech_start),
        'speech_end_offset': int(speech_end),
        'duration_seconds': meta['duration'],
        'segments': speech_segments,
        'full_transcript': ' '.join(s['text'] for s in speech_segments),
    }


def _get_metadata(url: str) -> Dict:
    result = subprocess.run(
        ['yt-dlp', '--dump-json', url],
        capture_output=True, text=True, check=True
    )
    d = json.loads(result.stdout)
    return {
        'id': d['id'],
        'title': d['title'],
        'duration': d['duration'],
        'release_timestamp': d['release_timestamp'],
        'was_live': d.get('was_live', False),
    }


def _get_subtitles(url: str, video_id: str) -> str:
    with tempfile.TemporaryDirectory() as tmpdir:
        subprocess.run(
            ['yt-dlp', '--write-auto-subs', '--sub-langs', 'en',
             '--skip-download', '--output', os.path.join(tmpdir, 'sub'), url],
            capture_output=True, check=True
        )
        vtt_path = os.path.join(tmpdir, 'sub.en.vtt')
        if not os.path.exists(vtt_path):
            raise FileNotFoundError("영어 자막을 찾을 수 없습니다.")
        with open(vtt_path, 'r', encoding='utf-8') as f:
            return f.read()


def _detect_speech_bounds(segments: List[Dict]) -> tuple:
    """트럼프 발언 시작/끝 오프셋 감지"""
    start_offset = None
    end_offset = None

    for seg in segments:
        tl = seg['text'].lower()
        if start_offset is None:
            if any(kw in tl for kw in SPEECH_START_KEYWORDS):
                start_offset = seg['offset_sec']
        else:
            if any(kw in tl for kw in SPEECH_END_KEYWORDS):
                end_offset = seg['offset_sec'] + 30  # 마무리 여유
                break

    if start_offset is None:
        start_offset = 0.0
    if end_offset is None:
        end_offset = segments[-1]['offset_sec'] if segments else 0.0

    return start_offset, end_offset


def _fmt_sec(sec: float) -> str:
    m, s = divmod(int(sec), 60)
    return f"{m:02d}:{s:02d}"
