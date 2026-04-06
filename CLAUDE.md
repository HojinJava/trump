# 프로젝트 규칙

## 이벤트 유형별 상세 지침
이벤트 유형에 따라 파이프라인 동작이 다르다. 각 유형별 규칙은 아래 파일을 참조:

- @docs/CLAUDE-live.md — YouTube 라이브/영상 이벤트 (트럼프 연설, FOMC 발언)
- @docs/CLAUDE-earnings.md — 어닝콜 (corporate_earnings)
- @docs/CLAUDE-economic.md — 경제지표 발표 (economic_release)

---

## 데이터 저장 규칙

- **크롤링·수집된 데이터만 JSON으로 저장한다.**
  파서 출력(트랜스크립트, 세그먼트), 시장 분봉 데이터, Claude 분석 결과, 최종 이벤트 등 수집 결과물만 JSON 파일로 저장한다.

- **공유되면 안 되는 코드·설정은 JSON으로 저장하지 않는다.**
  API 키, 시크릿, 계좌번호, 토큰 등 민감 정보는 `config.txt`에만 보관하고 JSON 파일에 절대 포함하지 않는다.

## Git 규칙

- **push 허용 파일**: `index.json`, `tickers.json`, `data/{id}/event.json`, `index.html`, `main.js`, `style.css`, `README.md`, `.gitignore`, `schema/*.json`, `docs/CLAUDE-*.md`
- **push 금지**: Python 소스코드, config, 토큰 캐시, `archiving/` 하위 중간 파일 전부
- `.gitignore`는 화이트리스트 방식(`*`로 전체 무시 후 허용 파일만 `!` 추가)으로 관리한다.

## 파이프라인 규칙

- 각 단계(parse → plan → fetch → analyze → build)는 파일을 읽고 쓰는 것만 한다. 메모리로 데이터를 단계 간에 넘기지 않는다.
- **중간 파일 경로**: `archiving/{event_id}/` 하위에 이벤트별로 모아서 저장
  - `archiving/{id}/raw.json` — 파서 출력 (트랜스크립트, 세그먼트)
  - `archiving/{id}/tickers.json` — 이 이벤트에서 수집할 티커 목록 (키 배열, 예: `["nasdaq","btc","googl"]`)
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
- **이벤트 티커 필터는 `step_build`의 모든 출력에 일관 적용한다.** `archiving/{id}/tickers.json`이 존재하면 `top_volatility`, `chart_data.series`, `price_changes` **세 곳 모두** 해당 티커 목록으로 필터링해야 한다. 하나라도 누락되면 제거한 티커가 뷰어에 다시 노출된다.
- **JSON 파일은 REST 엔드포인트처럼 설계한다.** `GET /tickers.json`, `GET /index.json`, `GET /data/{id}/event.json` 형태로 역할이 명확히 구분되어야 한다. 향후 실제 DB + API 서버로 교체할 때 각 JSON이 하나의 엔드포인트로 1:1 대응된다.
- **스키마 메타정보는 `schema/` 에 유지한다.** JSON 구조가 바뀔 때마다 `schema/{파일명}.json`도 함께 업데이트한다. DB 마이그레이션 시 참조 목적이다.
- **한국어는 `data/` 아래 JSON에만 존재한다.** `archiving/`의 원본 데이터는 수집된 그대로(영어) 보관한다. 번역·가공된 값은 `analysis.json` → `step_build` → `event.json` 흐름으로 생성된다.

## price_changes 기준 규칙

- **`pre_time_kst`** = `broadcast_at` KST (방송 시작 시각) — 모든 자산 동일
- **`post_time_kst`** = `speech_end_kst` (연설 종료 시각) — 모든 자산 동일
- 해당 시각 **±5분** 이내 캔들이 없는 자산은 `price_changes`에서 제외한다.
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
- **economic_release top_volatility 필터**: `step_build`에서 `economic_release` 이벤트의 `top_volatility`는 차트 윈도우(broadcast_at ~ broadcast_at+10분) 내 zone만 포함한다. 필터 후 rank를 1부터 재번호한다.
- **차트 시간 범위 트림**: `step_build`에서 chart_data를 구성할 때, 뒤쪽에 변동성이 없는(flat) 구간은 제거한다. 기준: 마지막 `top_volatility` zone의 `end_time` 이후로 모든 자산의 가격 변동이 미미한 구간은 여유 30분만 남기고 잘라낸다.
- **top_volatility zone 품질 필터**: `step_build`에서 다음 조건을 만족하지 않는 zone은 랭킹에서 제거하고 rank를 1부터 재번호한다.
  - `candle_count` ≤ 10 (구간 최대 10분 — 10분 초과 zone은 단일 이벤트가 아닌 배경 노이즈로 간주)
  - `window_vol` ≥ 10.0 (변동폭 최소 임계값 — 미만은 통계적으로 유의하지 않은 노이즈)
- **기본 티커는 24시간 거래 가능한 선물(Futures) 종목으로 수집한다.** ETF·주식 종목은 미국 장중에만 데이터가 있어 KST 오전 발언 시 데이터 공백이 발생하므로 기본 프로필에서는 사용하지 않는다.
  - ✅ 허용 (기본): CME 선물 (NQ, CL, GC, ZB, BTC, ETH 등), 국내 지수 (코스피 등)
  - ❌ 금지 (기본): 미국 ETF (IBIT, ETHA, TLT 등), 일반 미국 주식
  - ✅ 허용 (어닝콜): 미국 장 마감 후 이벤트에 한해 QQQ/SPY ETF, 반도체 주식 — Polygon.io로 수집
- **KIS API 미제공 시 Yahoo Finance로 우회**: KIS API가 과거 분봉을 지원하지 않는 자산(예: 코스피 지수)은 **Yahoo Finance REST API**로 수집한다.
  - TradingView `data.tradingview.com`은 서버 환경에서 IP 차단되므로 사용하지 않는다.
- **장 마감 후 이벤트의 분봉 데이터 대체**: 이벤트 시간대에 거래가 없는 자산은 분봉 대신 **직전 거래일 종가(closing price)**를 단일 데이터포인트로 사용한다.

## 다국어 규칙

- 이벤트 제목: `title`(원문) + `title_ko`(한국어) 병행 저장
- 발언 세그먼트: `transcript_segment`(원문 전체) + `transcript_segment_ko`(한국어 번역) 병행 저장
- 프론트엔드: **한국어 우선 표시**, 원문은 '원문 보기' 토글로 숨김
- 시간 표시: **모든 시각은 KST(한국 표준시) 기준**, `+09:00` ISO 형식으로 저장, JS에서 시간 변환 없음

## 소스 타입별 파이프라인 차이

| source | 트랜스크립트 | fetch 범위 | zone 텍스트 |
|---|---|---|---|
| `youtube_live` | YouTube 자막 | 연설 시작~종료+1h | 해당 구간 발언 |
| `youtube_video` | YouTube 자막 | 연설 시작~종료+1h | 해당 구간 발언 |
| `twitter` | 트윗 본문 | 트윗 시각±1h | 트윗 텍스트 |
| `economic_release` | 없음 | 발표 시각±45분 | "지표 발표 후 시장 반응" |

## 과거 오류 및 재발 방지 규칙

### 1. Windows 인코딩 오류 (UnicodeEncodeError)
- **규칙**: `collect.py` 실행 시 반드시 `python -X utf8 collect.py` 사용.

### 2. ET 시간대 파싱 오류 (방송 시각 1시간 오차)
- **규칙**: `youtube_video` 소스 등록 후 `raw.json`의 `broadcast_at` UTC 시각 반드시 검증.

### 3. YouTube 자막 API 빈 응답 (segments 0개)
- **규칙**: `raw.json`의 `segments` 배열이 0이면 `zone_segments.json`도 비어 파이프라인 전체 무의미. timedtext API 실패 시 `youtube_transcript_api` 라이브러리 자동 폴백.

### 4. 분석 공통 필드 누락 (rage=0, market_brag=0 등)
- **규칙**: `rage`, `trade_war_signal`, `market_brag`, `keywords`, `primary_target`, `targets`, `minute_summaries`는 **모든 이벤트에 필수**.

### 5. 30일 이상 과거 분봉 데이터 없음
- **규칙**: Yahoo Finance 1분봉은 최근 30일만 제공. **Polygon.io** 사용 (주식·ETF). 이벤트 등록은 발생 직후 30일 이내에 진행.

### 6. market_brag가 analysis.json 값을 무시하는 문제
- **규칙**: `rage`·`trade_war_signal`처럼 `market_brag`도 `analysis.json` 값이 있으면 우선 적용.

### 7. 이벤트별 티커 하드코딩 문제
- **규칙**: 티커 목록은 `archiving/{id}/tickers.json`에만 저장.

### 8. 티커 필터 누락으로 제거한 티커가 재노출
- **규칙**: `step_build`에서 `top_volatility`, `chart_data.series`, `price_changes` **세 곳 모두** `_event_tickers`로 필터링. 어닝콜의 경우 `top_volatility_release`, `price_changes_release`도 동일하게 필터링.
