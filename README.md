# Trump Index

트럼프 발언을 분석해 시장 반응과 연결하는 데이터 시각화 프로젝트.

트럼프의 공식 발언(YouTube, Twitter 등)을 수집·분석하고, 발언 구간별 주요 자산(NASDAQ, KOSPI, BTC ETF, 금, 원유, 채권)의 5분 변동성을 연결해 어떤 발언이 시장을 얼마나 흔들었는지 보여줍니다.

## 구성

- `data.json` — 수집된 이벤트 데이터 (로컬 CLI로 생성)
- `index.html` / `main.js` / `style.css` — GitHub Pages 뷰어

## 데이터 구조

```json
{
  "events": [
    {
      "id": "youtube_xxxxx",
      "title": "Trump Speech Title",
      "broadcast_at": "2026-04-01T14:30:00+00:00",
      "indices": {
        "rage": 72,
        "primary_target": "China",
        "trade_war": 85,
        "chaos": 43,
        "market_brag": 10,
        "trump_risk_score": 68
      },
      "top_volatility": [
        {
          "rank": 1,
          "time": "2026-04-01T15:12:00+00:00",
          "asset": "nasdaq",
          "window_vol": 0.8234,
          "transcript_segment": "We will impose 100% tariffs...",
          "youtube_url": "https://youtu.be/xxxxx?t=2520"
        }
      ]
    }
  ]
}
```

## 지수 설명

| 지수 | 설명 |
|------|------|
| rage | 감정 온도 (0~100). 공격적 언어, 대문자 강조, 혐오 표현 등 |
| trade_war | 무역 공격성 (0~100). 관세·제재·무역전쟁 언급 강도 |
| chaos | 혼돈 지수 (0~100). 발언 구간 자산 변동성 기반 |
| market_brag | 시장 자랑 (0~100). 주가 상승 공치사 언급 강도 |
| trump_risk_score | 종합 리스크 = rage×0.4 + trade_war×0.3 + chaos×0.3 |

## 뷰어

GitHub Pages: `https://hojinjava.github.io/trump`

- 이벤트 목록 및 지수 차트
- 발언 구간별 TOP 20 변동성 타임라인
- [원문] 링크로 YouTube 해당 구간 바로 이동
