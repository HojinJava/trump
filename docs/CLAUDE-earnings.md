# 어닝콜 파이프라인 규칙
> 적용 대상: `category = corporate_earnings` (NVIDIA, Google 등 기업 실적 발표 + 어닝콜)

## 수집 실행 순서

```
python collect.py                        # parse → plan → fetch → segments
Claude CLI: archiving/{id}/zone_segments.json 분석  # analysis.json 생성 (earnings_release 포함)
python collect.py --build <event_id>     # build → data/{id}/event.json + index.json
```

## fetch 범위 (자동 확장)
- `step_plan`이 `analysis.json`에서 `earnings_release.release_time_utc`를 감지하면
  수집 시작을 **실발 30분 전**으로 자동 확장한다.
- 자동 확장이 안 된 경우(최초 수집 시) `fetch_plan.json`의 `start_utc`를 직접 수정 후
  `--force market` → `--force event` 재실행.

## 티커 설정
- 어닝콜 이벤트는 미국 장 마감 후 진행되므로 CME 선물 대신 미국 주식·ETF 사용.
  - `nasdaq` → QQQ (Polygon), `sp500` → SPY (Polygon)
  - 관련 반도체 주식: nvda, googl, mu, amd, avgo (Polygon)
- `archiving/{id}/tickers.json`에 직접 지정.

## analysis.json 필수 항목

### 공통 필드 (모든 이벤트 동일)
`rage`, `trade_war_signal`, `market_brag`, `keywords`, `primary_target`, `targets`, `minute_summaries`
→ 어닝콜에서의 의미: CEO 확신도, 실적 서프라이즈 강도, 가이던스 자신감, 핵심 제품·기술 키워드

### 어닝콜 전용 추가 필드
```json
"earnings_release": {
  "release_time_utc": "YYYY-MM-DDTHH:MM:00+00:00",
  "eps": { "actual": 0.89, "estimate": 0.84, "surprise_pct": 5.95 },
  "revenue": { "actual": 39.3, "estimate": 38.1, "unit": "B USD", "surprise_pct": 3.15 },
  "guidance_text": "다음 분기 가이던스 설명 (한국어)"
}
```
- `speech_end_kst`: 어닝콜 종료 시각 (KST HH:MM)
- `speech_summary.trump_risk_score`: 직접 지정 (공식 무시)

## step_build가 생성하는 어닝콜 전용 데이터

### price_changes (발언 전후)
- 기존과 동일: broadcast_at 기준 어닝콜 전후 최대 변동폭

### price_changes_release (실발 전후 ±20분)
- `earnings_release.release_time_utc` ±20분의 캔들을 비교.
- `event.json`의 `price_changes_release` 필드에 저장.
- 데이터 없으면 null.

### top_volatility — 단일 통합 랭킹 (어닝콜 + 실발)
- `step_build`는 실발 ±10분 zones (`_top_er`, tagged `window='release'`)과
  어닝콜 구간 zones (`top20`, tagged `window='call'`)을 **하나의 리스트**로 병합한다.
- 병합 규칙: 동일 (asset, time) 쌍은 중복 제거 (call 우선). 전체를 `window_vol` 내림차순 재랭킹.
- `event.json`의 `top_volatility` 하나에만 저장. `top_volatility_release` 필드는 사용하지 않음 (null).
- 각 항목에 `window: 'release' | 'call'` 필드 포함.
- 품질 필터: candle_count ≤ 10, window_vol ≥ 10.0 (CLAUDE.md 공통 규칙과 동일).
- 실발 ±10분 기준선: 실발 10~40분 전 캔들.

## 프론트엔드 출력
- indices 카드 대신 `earnings_release` 표(EPS/매출 실적·예상·서프라이즈) 렌더링.
- 차트 수직선 3개: 실적 발표(황색), 어닝콜 시작(적색), 어닝콜 종료(보라).
  - 실발 시각이 차트 윈도우 밖이면 왼쪽 끝(index 0)에 실제 시각 라벨로 고정 표시.
- 차트 가로 스크롤 지원 (데이터 길이에 따라 min-width 자동 계산).
- 요약 카드에 **실적 발표 전후 주가 변동(±20분)** (왼쪽) + **어닝콜 전후 주가 변동** (오른쪽) 나란히 표시.
- 변동성 랭킹: 단일 리스트. 각 항목에 `실발±10분` / `어닝콜` 배지로 구간 표시.
  - `renderVolItem`과 `renderVolItemGlobal` 양쪽 모두 `window` 필드로 배지 렌더링.

## 오류 방지

### 실발 이전 데이터 없음
- `step_build`에서 `price_changes_release` / `top_volatility_release`가 null이면
  `fetch_plan.start_utc`가 실발 30분 전보다 늦은 것. `fetch_plan.json` 수정 후 재수집.
- 자동 확장은 `analysis.json`이 존재해야 동작 (최초 수집 시는 수동 처리).

### 30일 이상 과거 데이터
- Yahoo Finance 1분봉은 30일 제한. Polygon.io 사용 (주식·ETF 모두 지원).
- CME 선물은 `kis_fetcher.py`의 KIS API → 30일 이상은 Polygon 사용 불가 → 이벤트 등록을 30일 이내에 진행.
