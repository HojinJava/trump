https://hojinjava.github.io/trump

# Trump Index

## data.json

```json
{
  "events": [
    {
      "id": "youtube_xxxxx",
      "title": "...",
      "broadcast_at": "2026-04-01T14:30:00+00:00",
      "duration_seconds": 3600,
      "transcript": "...",
      "indices": {
        "rage": 72,
        "primary_target": "China",
        "targets": ["China", "Fed"],
        "trade_war": 85,
        "chaos": 43,
        "market_brag": 10,
        "trump_risk_score": 68,
        "keywords": ["tariff", "china", "deal"]
      },
      "minute_summaries": [
        { "minute": 0, "summary": "..." }
      ],
      "top_volatility": [
        {
          "rank": 1,
          "time": "2026-04-01T15:12:00+00:00",
          "asset": "nasdaq",
          "window_vol": 0.8234,
          "video_offset_seconds": 2520,
          "youtube_url": "https://youtu.be/xxxxx?t=2520",
          "transcript_segment": "We will impose 100% tariffs...",
          "market_moves": { "nasdaq": -0.42, "kospi": -0.31, "btc": -0.18 }
        }
      ],
      "market_candles": {
        "nasdaq": [
          { "time": "2026-04-01T14:30:00+00:00", "open": 21841.99, "high": 21852.24, "low": 21839.27, "close": 21847.53, "volatility": 0.0594 }
        ]
      }
    }
  ]
}
```

## index.html

```
index.html   진입점
main.js      data.json 로드 → 차트·타임라인 렌더링
style.css    스타일
```
