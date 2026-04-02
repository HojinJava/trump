# src/parsers/twitter.py
import re
import requests
from datetime import datetime, timezone
from typing import Dict
from bs4 import BeautifulSoup

TWITTER_EPOCH = 1288834974657  # 2010-11-04T01:42:54.657Z in ms


def collect(url: str) -> Dict:
    """Twitter/X 트윗 수집"""
    tweet_id = extract_tweet_id(url)
    posted_at = snowflake_to_utc(int(tweet_id))

    print(f"  트윗 ID: {tweet_id}")
    print(f"  포스팅 시각 (UTC): {posted_at.isoformat()}")

    text = _scrape_tweet_text(url)

    return {
        'id': tweet_id,
        'source': 'twitter',
        'url': url,
        'title': text[:80] + ('...' if len(text) > 80 else ''),
        'broadcast_at': posted_at.isoformat(),
        'speech_start_offset': 0,
        'speech_end_offset': 0,
        'duration_seconds': 0,
        'segments': [{'offset_sec': 0, 'text': text,
                      'real_time': posted_at.isoformat(), 'youtube_url': None}],
        'full_transcript': text,
    }


def extract_tweet_id(url: str) -> str:
    match = re.search(r'/status/(\d+)', url)
    if not match:
        raise ValueError(f"트윗 ID를 URL에서 찾을 수 없습니다: {url}")
    return match.group(1)


def snowflake_to_utc(tweet_id: int) -> datetime:
    timestamp_ms = (tweet_id >> 22) + TWITTER_EPOCH
    return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)


def _scrape_tweet_text(url: str) -> str:
    """공개 트윗 텍스트 크롤링 (nitter 미러 사용)"""
    tweet_id = extract_tweet_id(url)
    nitter_url = f"https://nitter.privacydev.net/i/status/{tweet_id}"
    try:
        resp = requests.get(nitter_url, timeout=10,
                            headers={'User-Agent': 'Mozilla/5.0'})
        soup = BeautifulSoup(resp.text, 'html.parser')
        tweet_div = soup.find('div', class_='tweet-content')
        if tweet_div:
            return tweet_div.get_text(strip=True)
    except Exception:
        pass
    return "[텍스트 추출 실패 — 수동 입력 필요]"
