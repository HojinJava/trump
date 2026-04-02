# src/market/kis.py
import os
import requests
from datetime import datetime, timezone, timedelta
from typing import Dict, List
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "https://openapi.koreainvestment.com:9443"

_token_cache = {'token': None, 'expires_at': None}


def _get_token() -> str:
    """OAuth 토큰 발급 (24시간 캐시)"""
    now = datetime.now(timezone.utc)
    if _token_cache['token'] and _token_cache['expires_at'] > now:
        return _token_cache['token']

    resp = requests.post(f"{BASE_URL}/oauth2/tokenP", json={
        'grant_type': 'client_credentials',
        'appkey': os.environ['KIS_APP_KEY'],
        'appsecret': os.environ['KIS_APP_SECRET'],
    }, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    _token_cache['token'] = data['access_token']
    _token_cache['expires_at'] = now + timedelta(hours=23)
    return _token_cache['token']


def _headers(tr_id: str) -> Dict:
    return {
        'content-type': 'application/json',
        'authorization': f"Bearer {_get_token()}",
        'appkey': os.environ['KIS_APP_KEY'],
        'appsecret': os.environ['KIS_APP_SECRET'],
        'tr_id': tr_id,
    }


def get_nasdaq_candles(start_utc: datetime, end_utc: datetime) -> List[Dict]:
    """나스닥 지수 1분봉 (해외지수분봉조회)"""
    start_kst = start_utc + timedelta(hours=9)
    end_kst = end_utc + timedelta(hours=9)

    params = {
        'FID_ETC_CLS_CODE': '',
        'FID_COND_MRKT_DIV_CODE': 'N',
        'FID_INPUT_ISCD': 'COMP',
        'FID_INPUT_HOUR_1': start_kst.strftime('%H%M%S'),
        'FID_INPUT_DATE_1': start_kst.strftime('%Y%m%d'),
        'FID_INPUT_DATE_2': end_kst.strftime('%Y%m%d'),
        'FID_PW_DATA_INCU_YN': 'N',
    }
    resp = requests.get(
        f"{BASE_URL}/uapi/overseas-price/v1/quotations/inquire-time-indexchartprice",
        headers=_headers('FHKST03030200'),
        params=params, timeout=15
    )
    resp.raise_for_status()
    return _parse_kis_candles(resp.json(), start_utc, end_utc)


def get_kospi_candles(start_utc: datetime, end_utc: datetime) -> List[Dict]:
    """KOSPI 1분봉 (국내 지수분봉조회)"""
    start_kst = start_utc + timedelta(hours=9)
    end_kst = end_utc + timedelta(hours=9)

    params = {
        'FID_COND_MRKT_DIV_CODE': 'U',
        'FID_INPUT_ISCD': '0001',
        'FID_INPUT_HOUR_1': end_kst.strftime('%H%M%S'),
        'FID_PW_DATA_INCU_YN': 'N',
    }
    resp = requests.get(
        f"{BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-time-indexchartprice",
        headers=_headers('FHKUP03500100'),
        params=params, timeout=15
    )
    resp.raise_for_status()
    return _parse_kis_candles(resp.json(), start_utc, end_utc)


def _parse_kis_candles(data: Dict, start_utc: datetime, end_utc: datetime) -> List[Dict]:
    items = data.get('output2', [])
    result = []
    for item in items:
        try:
            date_str = item.get('stck_bsop_date', '')
            time_str = item.get('stck_cntg_hour', '000000')
            dt_kst = datetime.strptime(f"{date_str}{time_str}", '%Y%m%d%H%M%S')
            dt_utc = (dt_kst - timedelta(hours=9)).replace(tzinfo=timezone.utc)

            if not (start_utc <= dt_utc <= end_utc):
                continue

            open_p = float(item.get('stck_oprc', 0))
            high_p = float(item.get('stck_hgpr', 0))
            low_p = float(item.get('stck_lwpr', 0))
            close_p = float(item.get('stck_prpr', 0))
            if open_p == 0:
                continue

            vol = (high_p - low_p) / open_p * 100
            result.append({
                'time': dt_utc.isoformat(),
                'open': round(open_p, 2),
                'high': round(high_p, 2),
                'low': round(low_p, 2),
                'close': round(close_p, 2),
                'volatility': round(vol, 4),
            })
        except (ValueError, KeyError):
            continue
    return sorted(result, key=lambda x: x['time'])
