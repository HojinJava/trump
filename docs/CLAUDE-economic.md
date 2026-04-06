# 경제지표 파이프라인 규칙
> 적용 대상: `source = economic_release` (NFP, CPI, FOMC 금리 결정 등 경제지표 발표)

## 수집 실행 순서

```
python collect.py                        # 옵션 4 선택 → 지표명/발표시각/실제값/예상값 입력
Claude CLI: archiving/{id}/zone_segments.json 분석  # analysis.json 생성
python collect.py --build <event_id>     # build → data/{id}/event.json + index.json
```

- extra 형식: `"NFP|2026-04-03 08:30 ET|178000|65000|151000"` (previous 포함 시)

## fetch 범위
- `start_utc` = 발표 시각 − 30분 (baseline용)
- `end_utc` = 발표 시각 + 45분

## 차트 윈도우
- 발표 시각 ±10분 (총 20분 구간), 1분봉 상세 뷰.
- `top_volatility`는 차트 윈도우 내 zone만 포함, rank 재번호.

## analysis.json 필수 항목

- `speech_end_kst`: 발표 시각 KST (zone_segments.json의 `release_kst` 값과 동일)
- `category`: `"employment"` (NFP, 실업률 등) 또는 `"economic_indicator"` (FOMC, CPI, PPI, GDP)
- `title_ko`: 한국어 제목 (예: "3월 미국 고용보고서 (NFP +178K)")
- `speech_summary`: 발표 수치 해석 + 시장 반응 분석
- `segment_translations` **불필요** — 트랜스크립트 없음
- 공통 필드: `rage`, `trade_war_signal`, `market_brag`, `keywords`, `primary_target`, `targets`
  (`minute_summaries` 불필요)

## 프론트엔드 출력
- 발표 시각 기준 수직선 1개 (적색 '발표' 라벨).
- zone 텍스트: "지표 발표 후 시장 반응" (트랜스크립트 없으므로 고정 문자열).
