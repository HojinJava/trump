# src/market/binance.py
from datetime import datetime, timezone
from typing import Dict, List
import requests

BASE_URL = "https://api.binance.com/api/v3/klines"

SYMBOLS = {
    'btc': 'BTCUSDT',
    'eth': 'ETHUSDT',
}


def get_candles(asset: str, start_utc: datetime, end_utc: datetime) -> List[Dict]:
    """
    Binance 1분봉 반환 (인증 불필요).
    asset: 'btc' | 'eth'
    """
    symbol = SYMBOLS[asset]
    start_ms = int(start_utc.timestamp() * 1000)
    end_ms = int(end_utc.timestamp() * 1000)

    params = {
        'symbol': symbol,
        'interval': '1m',
        'startTime': start_ms,
        'endTime': end_ms,
        'limit': 1000,
    }
    resp = requests.get(BASE_URL, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    result = []
    for k in data:
        open_price = float(k[1])
        if open_price == 0:
            continue
        high = float(k[2])
        low = float(k[3])
        close = float(k[4])
        vol = (high - low) / open_price * 100
        result.append({
            'time': datetime.fromtimestamp(k[0] / 1000, tz=timezone.utc).isoformat(),
            'open': round(open_price, 2),
            'high': round(high, 2),
            'low': round(low, 2),
            'close': round(close, 2),
            'volatility': round(vol, 4),
        })
    return result
