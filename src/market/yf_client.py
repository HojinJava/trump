# src/market/yf_client.py
from datetime import datetime, timezone, timedelta
from typing import Dict, List
import yfinance as yf

SYMBOLS = {
    'oil':   'CL=F',
    'gold':  'GC=F',
    'bonds': 'TLT',
}


def get_candles(asset: str, start_utc: datetime, end_utc: datetime) -> List[Dict]:
    """
    1분봉 OHLCV 반환.
    asset: 'oil' | 'gold' | 'bonds'
    반환: [{'time': ISO str, 'open': float, 'high': float, 'low': float,
             'close': float, 'volatility': float}, ...]
    """
    symbol = SYMBOLS[asset]
    ticker = yf.Ticker(symbol)

    df = ticker.history(start=start_utc, end=end_utc, interval='1m')
    if df.empty:
        return []

    result = []
    for ts, row in df.iterrows():
        open_price = float(row['Open'])
        if open_price == 0:
            continue
        vol = (float(row['High']) - float(row['Low'])) / open_price * 100
        result.append({
            'time': ts.to_pydatetime().astimezone(timezone.utc).isoformat(),
            'open': round(open_price, 4),
            'high': round(float(row['High']), 4),
            'low': round(float(row['Low']), 4),
            'close': round(float(row['Close']), 4),
            'volatility': round(vol, 4),
        })
    return result
