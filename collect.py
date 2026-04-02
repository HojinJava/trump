#!/usr/bin/env python3
# collect.py — Trump Index 데이터 수집 CLI
import sys
from datetime import datetime, timezone, timedelta

from src.parsers import youtube_live, youtube_video, twitter
from src.market import kis, binance, yf_client
from src.analysis import claude_analyzer
from src.analysis.volatility import calc_top_volatility, map_segments, calc_market_indices
from src.writer import save_event


def main():
    print("=" * 50)
    print("  Trump Index — 데이터 수집")
    print("=" * 50)
    print()
    print("어떤 소스인가요?")
    print("  1) YouTube 라이브 영상")
    print("  2) YouTube 일반 영상")
    print("  3) X (Twitter)")
    print()
    choice = input("선택 (1/2/3): ").strip()

    if choice == '1':
        url = input("YouTube URL: ").strip()
        event_raw = youtube_live.collect(url)
    elif choice == '2':
        url = input("YouTube URL: ").strip()
        time_str = input("방송 시작 시각 (예: 2026-04-01 21:00 ET): ").strip()
        event_raw = youtube_video.collect(url, time_str)
    elif choice == '3':
        url = input("트윗 URL: ").strip()
        event_raw = twitter.collect(url)
    else:
        print("잘못된 선택입니다.")
        sys.exit(1)

    print()
    print(f"제목: {event_raw['title']}")
    print(f"발언 시각 (UTC): {event_raw['broadcast_at']}")
    print(f"세그먼트: {len(event_raw['segments'])}개")

    # 시장 데이터 수집
    print()
    print("[시장 데이터 수집 중...]")
    broadcast_utc = datetime.fromisoformat(event_raw['broadcast_at'])
    duration_sec = max(event_raw.get('duration_seconds', 3600), 60)
    end_utc = broadcast_utc + timedelta(seconds=duration_sec + 3600)

    all_candles = {}
    _safe_fetch(all_candles, 'nasdaq', lambda: kis.get_nasdaq_candles(broadcast_utc, end_utc))
    _safe_fetch(all_candles, 'kospi', lambda: kis.get_kospi_candles(broadcast_utc, end_utc))
    _safe_fetch(all_candles, 'btc', lambda: binance.get_candles('btc', broadcast_utc, end_utc))
    _safe_fetch(all_candles, 'eth', lambda: binance.get_candles('eth', broadcast_utc, end_utc))
    _safe_fetch(all_candles, 'oil', lambda: yf_client.get_candles('oil', broadcast_utc, end_utc))
    _safe_fetch(all_candles, 'gold', lambda: yf_client.get_candles('gold', broadcast_utc, end_utc))
    _safe_fetch(all_candles, 'bonds', lambda: yf_client.get_candles('bonds', broadcast_utc, end_utc))

    for asset, candles in all_candles.items():
        print(f"  {asset}: {len(candles)}개 캔들")

    # 변동성 TOP 20 계산
    print()
    print("[변동성 분석 중...]")
    top20 = calc_top_volatility(all_candles, top_n=20)
    top20 = map_segments(top20, event_raw['segments'])
    market_indices = calc_market_indices(all_candles)
    if top20:
        print(f"  TOP 20 산출 완료 (최대 변동성: {top20[0]['volatility']:.2f}%)")
    else:
        print("  시장 데이터 없음")

    # Claude 분석
    print()
    print("[Claude API 분석 중...]")
    duration_min = duration_sec // 60
    analysis = claude_analyzer.analyze(event_raw['full_transcript'], duration_min)
    print(f"  감정 온도: {analysis['rage']}/100")
    print(f"  주요 타깃: {analysis.get('primary_target', 'N/A')}")

    # trump_risk_score 계산
    rage = analysis.get('rage', 0)
    trade_war = analysis.get('trade_war_signal', 0)
    chaos = market_indices.get('chaos', 0)
    trump_risk_score = int(rage * 0.4 + trade_war * 0.3 + chaos * 0.3)

    # 이벤트 조립
    event = {
        'id': event_raw['id'],
        'source': event_raw['source'],
        'url': event_raw['url'],
        'title': event_raw['title'],
        'broadcast_at': event_raw['broadcast_at'],
        'duration_seconds': event_raw['duration_seconds'],
        'transcript': event_raw['full_transcript'][:2000],
        'indices': {
            'rage': analysis.get('rage', 0),
            'primary_target': analysis.get('primary_target', ''),
            'targets': analysis.get('targets', []),
            'trade_war': trade_war,
            'chaos': chaos,
            'market_brag': market_indices.get('market_brag', 0),
            'trump_risk_score': trump_risk_score,
            'keywords': analysis.get('keywords', []),
        },
        'minute_summaries': analysis.get('minute_summaries', []),
        'top_volatility': [
            {
                'rank': t['rank'],
                'time': t['time'],
                'asset': t['asset'],
                'volatility': t['volatility'],
                'video_offset_seconds': t.get('video_offset_seconds', 0),
                'youtube_url': t.get('youtube_url'),
                'transcript_segment': t.get('transcript_segment', ''),
                'market_moves': t.get('market_moves', {}),
            }
            for t in top20
        ],
        'market_candles': {
            asset: candles for asset, candles in all_candles.items()
        },
    }

    save_event(event)
    print()
    print(f"완료! Trump Risk Score: {trump_risk_score}/100")


def _safe_fetch(target: dict, key: str, fn):
    try:
        target[key] = fn()
    except Exception as e:
        print(f"  [{key}] 수집 실패: {e}")
        target[key] = []


if __name__ == '__main__':
    main()
