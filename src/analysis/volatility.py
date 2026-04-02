# src/analysis/volatility.py
from datetime import datetime, timezone
from typing import Dict, List
import statistics


def calc_top_volatility(all_candles: Dict[str, List], top_n: int = 20) -> List[Dict]:
    flat = []
    for asset, candles in all_candles.items():
        for c in candles:
            flat.append({**c, 'asset': asset})

    flat.sort(key=lambda x: x['volatility'], reverse=True)
    top = flat[:top_n]

    for i, item in enumerate(top):
        item['rank'] = i + 1
        item['market_moves'] = _get_moves_at_time(item['time'], all_candles)

    return top


def map_segments(top_volatility: List[Dict], segments: List[Dict]) -> List[Dict]:
    if not segments:
        return top_volatility

    for item in top_volatility:
        item_time = datetime.fromisoformat(item['time'])
        nearest = min(
            segments,
            key=lambda s: abs(
                datetime.fromisoformat(s['real_time']) - item_time
            )
        )
        item['transcript_segment'] = nearest['text']
        item['youtube_url'] = nearest.get('youtube_url')
        item['video_offset_seconds'] = int(nearest.get('offset_sec', 0))

    return top_volatility


def calc_market_indices(all_candles: Dict[str, List]) -> Dict:
    all_vols = [c['volatility'] for candles in all_candles.values() for c in candles]

    if not all_vols:
        return {'chaos': 0, 'trade_war': 0, 'market_brag': 0}

    mean_vol = statistics.mean(all_vols)
    chaos = min(int(mean_vol / 5.0 * 100), 100)

    drop = _calc_price_change(all_candles.get('nasdaq', []))
    drop += _calc_price_change(all_candles.get('kospi', []))
    trade_war = min(int(max(-drop, 0) / 3.0 * 100), 100)
    market_brag = min(int(max(drop, 0) / 3.0 * 100), 100)

    return {'chaos': chaos, 'trade_war': trade_war, 'market_brag': market_brag}


def _calc_price_change(candles: List[Dict]) -> float:
    if len(candles) < 2:
        return 0.0
    start = candles[0]['open']
    end = candles[-1]['close']
    if start == 0:
        return 0.0
    return (end - start) / start * 100


def _get_moves_at_time(time_str: str, all_candles: Dict[str, List]) -> Dict:
    target = datetime.fromisoformat(time_str)
    moves = {}
    for asset, candles in all_candles.items():
        if not candles:
            moves[asset] = 0.0
            continue
        nearest = min(candles, key=lambda c: abs(
            datetime.fromisoformat(c['time']) - target
        ))
        start = nearest['open']
        moves[asset] = round((nearest['close'] - start) / start * 100, 2) if start else 0.0
    return moves
