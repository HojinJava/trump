# 프로젝트 규칙

## 데이터 저장 규칙

- **크롤링·수집된 데이터만 JSON으로 저장한다.**
  파서 출력(트랜스크립트, 세그먼트), 시장 분봉 데이터, Claude 분석 결과, 최종 이벤트 등 수집 결과물만 JSON 파일로 저장한다.

- **공유되면 안 되는 코드·설정은 JSON으로 저장하지 않는다.**
  API 키, 시크릿, 계좌번호, 토큰 등 민감 정보는 `config.txt`에만 보관하고 JSON 파일에 절대 포함하지 않는다.

## Git 규칙

- **push 허용 파일**: `index.json`, `tickers.json`, `data/{id}/event.json`, `index.html`, `main.js`, `style.css`, `README.md`, `.gitignore`, `schema/*.json`
- **push 금지**: Python 소스코드, config, 토큰 캐시, `archiving/` 하위 중간 파일 전부
- `.gitignore`는 화이트리스트 방식(`*`로 전체 무시 후 허용 파일만 `!` 추가)으로 관리한다.

## 파이프라인 규칙

- 각 단계(parse → plan → fetch → analyze → build)는 파일을 읽고 쓰는 것만 한다. 메모리로 데이터를 단계 간에 넘기지 않는다.
- **중간 파일 경로**: `archiving/{event_id}/` 하위에 이벤트별로 모아서 저장
  - `archiving/{id}/raw.json` — 파서 출력 (트랜스크립트, 세그먼트)
  - `archiving/{id}/fetch_plan.json` — 시장 수집 계획 (start_utc, end_utc, broadcast_at)
  - `archiving/{id}/market.json` — KIS API 분봉 데이터
  - `archiving/{id}/analysis.json` — Claude 분석 결과 (title_ko, segment_translations, speech_summary 포함)
  - `archiving/{id}/manifest.json` — 각 단계 완료 여부 및 파라미터 추적
- **프론트엔드가 읽는 파일**:
  - `index.json` — 이벤트 목록 (id, title, title_ko, broadcast_at, trump_risk_score 등)
  - `data/{id}/event.json` — 이벤트 상세 데이터 (lazy load)
  - `tickers.json` — 티커 설정 (label, color 등) — REST `/tickers` 엔드포인트 역할

## JSON 데이터 설계 규칙

- **프론트엔드에서 연산하지 않는다.** 표시에 필요한 값(등락률, 포맷된 시각, 번역문 등)은 파이프라인(`step_build`)에서 사전 연산해 JSON에 저장한다. JS는 읽어서 출력만 한다.
- **프론트엔드에서 정렬하지 않는다.** `top_volatility` 배열의 순서가 곧 랭킹이다. 정렬·필터링·겹침 제거는 `step_build`에서 처리하고 JSON에 저장한다.
- **단일 진실 소스(SSoT)**: 같은 데이터를 여러 곳에 하드코딩하지 않는다.
  - 티커 정의(라벨·색상·설명)는 `tickers.json` 하나에만 존재한다.
  - 프론트엔드의 모든 섹션(요약·차트·랭킹 탭)은 `tickers.json`을 참조한다.
- **JSON 파일은 REST 엔드포인트처럼 설계한다.** `GET /tickers.json`, `GET /index.json`, `GET /data/{id}/event.json` 형태로 역할이 명확히 구분되어야 한다. 향후 실제 DB + API 서버로 교체할 때 각 JSON이 하나의 엔드포인트로 1:1 대응된다.
- **스키마 메타정보는 `schema/` 에 유지한다.** JSON 구조가 바뀔 때마다 `schema/{파일명}.json`도 함께 업데이트한다. DB 마이그레이션 시 참조 목적이다.
- **한국어는 `data/` 아래 JSON에만 존재한다.** `archiving/`의 원본 데이터는 수집된 그대로(영어) 보관한다. 번역·가공된 값은 `analysis.json` → `step_build` → `event.json` 흐름으로 생성된다.

## price_changes 기준 규칙

- **`pre_time_kst`** = `broadcast_at` KST (방송 시작 시각) — 모든 자산 동일
- **`post_time_kst`** = `speech_end_kst` (연설 종료 시각) — 모든 자산 동일
- 해당 시각 **±5분** 이내 캔들이 없는 자산은 `price_changes`에서 제외한다.
  - 예: 방송이 10:01 KST인데 해당 자산 데이터가 10:50부터 시작하면 제외
- 실제 사용된 캔들 시각과 기준 시각이 다를 수 있지만 JSON에는 **기준 시각(broadcast_at / speech_end_kst)**을 표기한다.
- 분봉이 sparse(드문) 자산은 ±5분을 초과해도 방송 시작 전후 10분 이내면 허용한다.

## 변동성 분석 규칙

- **방법론**: Event Study Methodology (MacKinlay 1997) 기반
- **지표**: Realized Volatility (RV) = `log(close/open)²` (1분봉)
- **기준선**: 발언 시작 **30분 전** 캔들로 μ, σ 계산 (pre-event baseline)
- **혼돈 구간**: z-score = `(RV - μ) / σ` ≥ 1.5 인 연속 캔들을 하나의 zone으로 묶음
- **랭킹 기준**: zone 내 z-score 합산(zone_score) 내림차순
- **발언 매핑**: zone 시작 시각이 아닌 **피크 캔들(z-score 최고점) 시각** 기준으로 트랜스크립트 세그먼트 매핑
- **market_moves 표시**: 피크 캔들 기준 등락률
- **차트 자산 필터링**: 방송 기간(broadcast_at ~ end_utc) 중 고유 타임스탬프가 **5개 이상**이고, 방송 시작 30분 이내에 첫 데이터가 존재하는 자산만 차트에 포함.
- **economic_release top_volatility 필터**: `step_build`에서 `economic_release` 이벤트의 `top_volatility`는 차트 윈도우(broadcast_at ~ broadcast_at+10분) 내 zone만 포함한다. 필터 후 rank를 1부터 재번호한다. 차트에 보이지 않는 구간의 랭킹은 삭제한다.
- **차트 시간 범위 트림**: `step_build`에서 chart_data를 구성할 때, 뒤쪽에 변동성이 없는(flat) 구간은 제거한다. 기준: 마지막 `top_volatility` zone의 `end_time` 이후로 모든 자산의 가격 변동이 미미한 구간은 여유 30분만 남기고 잘라낸다.
- **기본 티커는 24시간 거래 가능한 선물(Futures) 종목으로 수집한다.** ETF·주식 종목은 미국 장중에만 데이터가 있어 KST 오전 발언 시 데이터 공백이 발생하므로 기본 프로필에서는 사용하지 않는다.
  - ✅ 허용 (기본): CME 선물 (NQ, CL, GC, ZB, BTC, ETH 등), 국내 지수 (코스피 등)
  - ❌ 금지 (기본): 미국 ETF (IBIT, ETHA, TLT 등), 일반 미국 주식
  - ✅ 허용 (tech_ai 프로필): 미국 장 마감 후 이벤트(어닝콜 등)에 한해 반도체 주식(GOOGL/MU/AMD/AVGO) 예외 허용 — Yahoo Finance `prepost=True`로 애프터마켓 데이터 수집
  - 티커 기준: `tickers.json`의 `desc_ko` 참조
- **KIS API 미제공 시 Yahoo Finance로 우회**: KIS API가 과거 분봉을 지원하지 않는 자산(예: 코스피 지수 — `inquire-time-indexchartprice`는 당일만 지원)은 **Yahoo Finance REST API**로 수집한다.
  - 엔드포인트: `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1m&period1={unix}&period2={unix}`
  - 코스피 심볼: `%5EKS11` (`^KS11`)
  - curl 또는 `requests` 라이브러리로 직접 호출 (인증 불필요, `User-Agent` 헤더 필수)
  - 응답의 `chart.result[0].timestamp` + `indicators.quote[0]` 필드를 파싱하여 표준 캔들 포맷으로 변환 후 `market.json`에 저장
  - TradingView `data.tradingview.com`은 서버 환경에서 IP 차단되므로 사용하지 않는다.

- **장 마감 후 이벤트의 분봉 데이터 대체**: 이벤트 시간대에 거래가 없는 자산(예: 코스피 지수 — KRX 정규장 09:00~15:45 KST 외 시간 방송)은 분봉 대신 **직전 거래일 종가(closing price)**를 단일 데이터포인트로 사용한다.
  - `step_fetch`에서 분봉 조회 결과가 0건이면 해당 자산의 직전 종가를 별도 조회하여 저장한다.
  - `step_build`에서 분봉 없는 자산은 차트·변동성 분석 대상에서 제외하고, `price_changes`의 `pre_price` / `post_price` 모두 종가로 채워 등락률 0%로 표시한다.
  - `event.json`의 해당 자산 항목에 `"data_type": "closing_price"` 플래그를 추가하여 프론트엔드가 "종가 기준" 배지를 표시할 수 있게 한다.

## 트랜스크립트 처리 규칙

YouTube 자동 자막은 슬라이딩 윈도우 방식으로 생성되어 세그먼트가 중복된다. 각 세그먼트는 `offset_sec`, `real_time`(UTC ISO), `text`, `youtube_url` 필드를 가진다.

### 연설 범위 판별
- `raw.json`의 `speech_start_offset` / `speech_end_offset` (초 단위) 또는 세그먼트의 `real_time` 범위로 실제 연설 구간을 확정한다.
- **`analysis.json`에 `speech_end_kst` 필드를 반드시 포함한다** (예: `"speech_end_kst": "10:20"`).

### 연설 후 zone 처리
- `top_volatility` zone의 피크 시각이 `speech_end_kst` 이후이면 발언이 아닌 **시장 반응 구간**이다.
- `step_build`는 연설 종료 후 zone의 `transcript_segment` / `transcript_segment_ko`를 **null**로 설정해야 한다.
- 이를 파이프라인이 자동 처리하지 못할 경우, `event.json`을 직접 수정한다.

### transcript_segment 원문 규칙
- `transcript_segment`는 짧은 스니펫이 아닌 **해당 zone 시간대의 전체 맥락 영어 원문**이어야 한다.
- YouTube 중복 캡션은 greedy overlap 방식으로 병합한다: 이전 누적 텍스트 끝과 새 세그먼트 앞이 겹치면 겹친 부분을 제거하고 이어 붙인다.
- `>>` 앵커 마커, 연속 공백 등을 정리하여 가독성 있는 단락으로 저장한다.

### segment_translations 커버리지 규칙
- **연설 내 모든 고유 zone**에 대응하는 `transcript_segment` 원문→한국어 번역이 포함되어야 한다.
- Claude CLI 분석 전 `archiving/{id}/zone_segments.json`을 읽어 각 zone의 `transcript_segment` 병합 원문을 확인한다.
- `segment_translations`의 키는 `zone_segments.json`의 `transcript_segment` 값과 **완전히 동일한 문자열**이어야 한다 (exact match).
- 한국어 값은 해당 구간의 요약·번역 (요약본 권장, 전체 번역 불필요).

## 다국어 규칙

- 이벤트 제목: `title`(원문) + `title_ko`(한국어) 병행 저장
- 발언 세그먼트: `transcript_segment`(원문 전체) + `transcript_segment_ko`(한국어 번역) 병행 저장
  - 번역 원천: `archiving/{id}/analysis.json`의 `segment_translations: {"원문 전체": "한국어"}` 맵
  - `step_build`가 top_volatility 세그먼트와 매핑하여 `event.json`에 포함
  - 연설 종료 후 zone은 두 필드 모두 `null`
- 프론트엔드: **한국어 우선 표시**, 원문은 '원문 보기' 토글로 숨김
- 시간 표시: **모든 시각은 KST(한국 표준시) 기준**, `+09:00` ISO 형식으로 저장, JS에서 시간 변환 없음

## 수집 실행 순서

```
python collect.py                          # parse → plan → fetch → segments
Claude CLI: archiving/{id}/zone_segments.json 분석   # analysis.json 생성
python collect.py --build <event_id>       # build → data/{id}/event.json + index.json
```

- `python collect.py` 실행 시 `archiving/{id}/zone_segments.json`이 자동 생성된다.
- Claude CLI 분석 전에 이 파일을 참고하여 각 zone의 `transcript_segment`를 번역 키로 사용한다.

### Claude CLI 분석 시 analysis.json 필수 포함 항목 (YouTube 연설)
- `speech_end_kst`: 연설 실제 종료 시각 (KST HH:MM) — raw.json의 segment real_time 마지막 값으로 확인
- `segment_translations`: 연설 내 모든 고유 zone의 transcript_segment 전체 원문 → 한국어 번역 맵
- `title_ko`, `speech_summary` (key_points, full_summary, market_impact_summary, price_changes 등)

### Claude CLI 분석 시 analysis.json 필수 포함 항목 (경제 지표 발표)
- `speech_end_kst`: 발표 시각 KST (zone_segments.json의 `release_kst` 값과 동일)
- `category`: 지표 종류에 따라 선택
  - 고용보고서(NFP), 실업률 등: `"employment"`
  - FOMC, CPI, PPI, GDP 등: `"economic_indicator"`
- `title_ko`: 한국어 제목 (예: "3월 미국 고용보고서 (NFP +178K)")
- `segment_translations` **불필요** — 트랜스크립트 없음
- `speech_summary`: 발표 수치 해석 + 시장 반응 분석

## 소스 타입별 파이프라인 차이

| source | 트랜스크립트 | fetch 범위 | zone 텍스트 |
|---|---|---|---|
| `youtube_live` | YouTube 자막 | 연설 시작~종료+1h | 해당 구간 발언 |
| `youtube_video` | YouTube 자막 | 연설 시작~종료+1h | 해당 구간 발언 |
| `twitter` | 트윗 본문 | 트윗 시각±1h | 트윗 텍스트 |
| `economic_release` | 없음 | 발표 시각±45분 | "지표 발표 후 시장 반응" |

- `economic_release` 수집: `collect.py` 옵션 4 선택 → 지표명, 발표 시각, 실제값, 예상값 입력
- extra 형식: `"NFP|2026-04-03 08:30 ET|178000|65000|151000"` (previous 선택)
