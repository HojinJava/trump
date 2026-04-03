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
- **단일 진실 소스(SSoT)**: 같은 데이터를 여러 곳에 하드코딩하지 않는다.
  - 티커 정의(라벨·색상·설명)는 `tickers.json` 하나에만 존재한다.
  - 프론트엔드의 모든 섹션(요약·차트·랭킹 탭)은 `tickers.json`을 참조한다.
- **JSON 파일은 REST 엔드포인트처럼 설계한다.** `GET /tickers.json`, `GET /index.json`, `GET /data/{id}/event.json` 형태로 역할이 명확히 구분되어야 한다. 향후 실제 DB + API 서버로 교체할 때 각 JSON이 하나의 엔드포인트로 1:1 대응된다.
- **스키마 메타정보는 `schema/` 에 유지한다.** JSON 구조가 바뀔 때마다 `schema/{파일명}.json`도 함께 업데이트한다. DB 마이그레이션 시 참조 목적이다.
- **한국어는 `data/` 아래 JSON에만 존재한다.** `archiving/`의 원본 데이터는 수집된 그대로(영어) 보관한다. 번역·가공된 값은 `analysis.json` → `step_build` → `event.json` 흐름으로 생성된다.

## 변동성 분석 규칙

- **방법론**: Event Study Methodology (MacKinlay 1997) 기반
- **지표**: Realized Volatility (RV) = `log(close/open)²` (1분봉)
- **기준선**: 발언 시작 **30분 전** 캔들로 μ, σ 계산 (pre-event baseline)
- **혼돈 구간**: z-score = `(RV - μ) / σ` ≥ 1.5 인 연속 캔들을 하나의 zone으로 묶음
- **랭킹 기준**: zone 내 z-score 합산(zone_score) 내림차순
- **발언 매핑**: zone 시작 시각이 아닌 **피크 캔들(z-score 최고점) 시각** 기준으로 트랜스크립트 세그먼트 매핑
- **market_moves 표시**: 피크 캔들 기준 등락률

## 다국어 규칙

- 이벤트 제목: `title`(원문) + `title_ko`(한국어) 병행 저장
- 발언 세그먼트: `transcript_segment`(원문) + `transcript_segment_ko`(한국어 번역) 병행 저장
  - 번역 원천: `archiving/{id}/analysis.json`의 `segment_translations: {"원문": "한국어"}` 맵
  - `step_build`가 top_volatility 세그먼트와 매핑하여 `event.json`에 포함
- 프론트엔드: **한국어 우선 표시**, 원문은 '원문 보기' 토글로 숨김
- 시간 표시: **모든 시각은 KST(한국 표준시) 기준**, `+09:00` ISO 형식으로 저장, JS에서 시간 변환 없음

## 수집 실행 순서

```
python collect.py                          # parse → plan → fetch
Claude CLI: archiving/{id}/raw.json 분석   # analysis.json 생성
python collect.py --build <event_id>       # build → data/{id}/event.json + index.json
```
