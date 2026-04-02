# src/parsers/youtube_video.py
import subprocess
import json
import tempfile
import os
from datetime import datetime, timezone, timedelta
from typing import Dict

from src.parsers.vtt_parser import parse_vtt, deduplicate_segments


def collect(url: str, broadcast_at_str: str) -> Dict:
    """
    YouTube 일반 영상 수집.
    broadcast_at_str: 사용자 입력 시각 (예: '2026-04-01 21:00 ET')
    """
    print(f"[1/3] 메타데이터 추출 중...")
    result = subprocess.run(['yt-dlp', '--dump-json', url],
                            capture_output=True, text=True, check=True)
    d = json.loads(result.stdout)
    video_id = d['id']
    title = d['title']
    duration = d['duration']

    print(f"[2/3] 자막 추출 중...")
    with tempfile.TemporaryDirectory() as tmpdir:
        subprocess.run(
            ['yt-dlp', '--write-auto-subs', '--sub-langs', 'en',
             '--skip-download', '--output', os.path.join(tmpdir, 'sub'), url],
            capture_output=True, check=True
        )
        vtt_path = os.path.join(tmpdir, 'sub.en.vtt')
        with open(vtt_path, 'r', encoding='utf-8') as f:
            vtt_content = f.read()

    print(f"[3/3] 세그먼트 파싱 중...")
    segments = deduplicate_segments(parse_vtt(vtt_content))

    broadcast_utc = _parse_broadcast_time(broadcast_at_str)

    for seg in segments:
        real_dt = broadcast_utc + timedelta(seconds=seg['offset_sec'])
        seg['real_time'] = real_dt.isoformat()
        seg['youtube_url'] = f"https://youtube.com/watch?v={video_id}&t={int(seg['offset_sec'])}"

    return {
        'id': video_id,
        'source': 'youtube_video',
        'url': url,
        'title': title,
        'broadcast_at': broadcast_utc.isoformat(),
        'speech_start_offset': 0,
        'speech_end_offset': duration,
        'duration_seconds': duration,
        'segments': segments,
        'full_transcript': ' '.join(s['text'] for s in segments),
    }


def _parse_broadcast_time(time_str: str) -> datetime:
    """
    '2026-04-01 21:00 ET' → UTC datetime
    지원 형식: ET(UTC-4), KST(UTC+9), UTC
    """
    tz_offsets = {'ET': -4, 'EST': -5, 'EDT': -4, 'KST': 9, 'UTC': 0}
    parts = time_str.strip().split()
    tz_str = parts[-1].upper() if parts[-1].upper() in tz_offsets else 'UTC'
    dt_str = ' '.join(parts[:-1])

    dt = datetime.strptime(dt_str, '%Y-%m-%d %H:%M')
    offset = tz_offsets.get(tz_str, 0)
    return (dt - timedelta(hours=offset)).replace(tzinfo=timezone.utc)
