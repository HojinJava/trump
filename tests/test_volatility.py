from src.analysis.volatility import calc_top_volatility, map_segments, calc_market_indices

SAMPLE_CANDLES = {
    'nasdaq': [
        {'time': '2026-04-01T21:00:00+00:00', 'open': 100.0, 'high': 102.0, 'low': 99.0, 'close': 101.0, 'volatility': 3.0},
        {'time': '2026-04-01T21:01:00+00:00', 'open': 101.0, 'high': 101.5, 'low': 100.8, 'close': 101.2, 'volatility': 0.69},
        {'time': '2026-04-01T21:02:00+00:00', 'open': 101.0, 'high': 105.0, 'low': 98.0, 'close': 99.0, 'volatility': 6.93},
    ],
    'btc': [], 'eth': [], 'oil': [], 'gold': [], 'bonds': [], 'kospi': [],
}

SAMPLE_SEGMENTS = [
    {'offset_sec': 0, 'text': 'Hello America', 'real_time': '2026-04-01T21:00:00+00:00', 'youtube_url': 'https://youtube.com/watch?v=x&t=0'},
    {'offset_sec': 60, 'text': 'Tariffs on China', 'real_time': '2026-04-01T21:01:00+00:00', 'youtube_url': 'https://youtube.com/watch?v=x&t=60'},
    {'offset_sec': 120, 'text': 'We will destroy them', 'real_time': '2026-04-01T21:02:00+00:00', 'youtube_url': 'https://youtube.com/watch?v=x&t=120'},
]

def test_calc_top_volatility_returns_sorted():
    top = calc_top_volatility(SAMPLE_CANDLES, top_n=2)
    assert len(top) == 2
    assert top[0]['volatility'] >= top[1]['volatility']

def test_calc_top_volatility_includes_asset():
    top = calc_top_volatility(SAMPLE_CANDLES, top_n=3)
    assert all('asset' in t for t in top)
    assert top[0]['asset'] == 'nasdaq'

def test_map_segments_finds_nearest():
    top = calc_top_volatility(SAMPLE_CANDLES, top_n=1)
    mapped = map_segments(top, SAMPLE_SEGMENTS)
    assert mapped[0]['transcript_segment'] == 'We will destroy them'

def test_calc_market_indices_chaos():
    indices = calc_market_indices(SAMPLE_CANDLES)
    assert 0 <= indices['chaos'] <= 100
