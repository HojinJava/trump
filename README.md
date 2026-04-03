https://hojinjava.github.io/trump

# Trump Index

트럼프 발언에 따른 실시간 시장 변동성 아카이브.

## 파일 구조

```
index.html          진입점
main.js             데이터 로드 → 차트·랭킹·요약 렌더링
style.css           스타일
tickers.json        티커 설정 (라벨·색상·설명)
index.json          이벤트 목록
data/{id}/
  event.json        이벤트 상세 데이터 (lazy load)
```

## 프론트엔드가 참조하는 파일

| 파일 | 역할 | 로드 시점 |
|------|------|-----------|
| [`tickers.json`](./tickers.json) | 티커 정의 (라벨·색상·설명) — 차트 범례·랭킹 배지 | 앱 시작 시 |
| [`index.json`](./index.json) | 이벤트 목록 (id, title_ko, broadcast_at, trump_risk_score 등) | 앱 시작 시 |
| `data/{id}/event.json` | 이벤트 상세 (차트 데이터·변동성 랭킹·연설 요약) | 이벤트 클릭 시 |

### event.json 주요 필드

| 필드 | 설명 |
|------|------|
| `tickers` | 이 이벤트에 활성화된 티커 목록 (순서 = 탭 순서) |
| `chart_data.times` | 차트 x축 타임스탬프 배열 (KST ISO) |
| `chart_data.series` | 자산별 % 변동 시계열 (`broadcast_at` 기준) |
| `top_volatility` | 변동성 구간 랭킹 (배열 순서 = 랭킹 순서) |
| `speech_summary.price_changes` | 발언 전후 주가 변동 (`pre_time_kst` ~ `post_time_kst`) |
| `speech_summary.key_points` | 연설 핵심 요약 |
