# 라이브/연설 이벤트 파이프라인 규칙
> 적용 대상: `source = youtube_live | youtube_video` (트럼프 연설, FOMC 발언 등 YouTube 기반 이벤트)

## 수집 실행 순서

```
python collect.py                        # parse → plan → fetch → segments
Claude CLI: archiving/{id}/zone_segments.json 분석  # analysis.json 생성
python collect.py --build <event_id>     # build → data/{id}/event.json + index.json
```

## fetch 범위
- `start_utc` = broadcast_at − 30분 (baseline용), `end_utc` = broadcast_at + duration + 1시간

## 트랜스크립트 처리

YouTube 자동 자막은 슬라이딩 윈도우 방식으로 생성되어 세그먼트가 중복된다.
각 세그먼트: `offset_sec`, `real_time`(UTC ISO), `text`, `youtube_url` 필드.

### 연설 범위 판별
- `raw.json`의 `speech_start_offset` / `speech_end_offset` (초) 또는 세그먼트 `real_time` 범위로 확정.
- **`analysis.json`에 `speech_end_kst` 필드 필수** (예: `"speech_end_kst": "10:20"`).

### 연설 후 zone 처리
- zone 피크 시각이 `speech_end_kst` 이후면 **시장 반응 구간**.
- `step_build`는 해당 zone의 `transcript_segment` / `transcript_segment_ko`를 **null**로 설정.

### transcript_segment 원문 규칙
- 짧은 스니펫이 아닌 **해당 zone 시간대의 전체 맥락 영어 원문**.
- YouTube 중복 캡션은 greedy overlap 방식으로 병합.
- `>>` 앵커 마커, 연속 공백 정리.

### segment_translations 커버리지 규칙
- **연설 내 모든 고유 zone**에 대응하는 원문→한국어 번역 포함.
- `segment_translations` 키는 `zone_segments.json`의 `transcript_segment` 값과 **exact match**.
- 한국어 값은 해당 구간 요약·번역 (요약본 권장).

## Claude CLI analysis.json 필수 항목

### 공통 (모든 YouTube 이벤트)

| 필드 | 트럼프 연설 | FOMC |
|------|------------|------|
| `rage` (0-100) | 분노·공격 수위 | 매파 강도 |
| `trade_war_signal` (0-100) | 무역전쟁 발언 강도 | 금리·통화정책 충격 |
| `market_brag` (0-100) | 시장 자랑 수위 | 경제 낙관 수위 |
| `keywords` | 핵심 위협어/공격어 | 핵심 정책어 |
| `primary_target` | 주요 공격 대상 | 주요 정책 포커스 지표 |
| `targets` | 공격 대상 목록 | 관련 정책 지표·기관 목록 |
| `minute_summaries` | 분당 발언 요약 | 분당 발언 요약 |

- `speech_end_kst`: 연설 실제 종료 시각 (KST HH:MM)
- `segment_translations`: 모든 고유 zone의 원문 → 한국어 번역 맵
- `title_ko`, `speech_summary` (key_points, full_summary, market_impact_summary)
- `speech_summary.trump_risk_score` (0-100): 비-트럼프 이벤트는 직접 지정

## 오류 방지

### ET 시간대 파싱 오류
- ET = EST(UTC-5) / EDT(UTC-4). 파싱 후 `raw.json`의 `broadcast_at` UTC 시각 반드시 검증.
- 오류 시 `raw.json` 직접 수정 후 `--force fetch_plan` → `--force market` → `--build`.

### YouTube 자막 API 빈 응답
- `raw.json`의 `segments` 0개면 파이프라인 전체 무의미.
- timedtext API 실패 시 `youtube_transcript_api` 라이브러리 자동 폴백.
- 폴백도 실패하면 세그먼트 수동 입력 필요.
