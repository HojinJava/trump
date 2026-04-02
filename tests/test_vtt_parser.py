from src.parsers.vtt_parser import parse_vtt, deduplicate_segments

SAMPLE_VTT = """WEBVTT
Kind: captions
Language: en

00:00:01.000 --> 00:00:03.000
Hello world

00:00:03.000 --> 00:00:03.010

00:00:03.010 --> 00:00:05.000
Hello world
This is a test

00:00:05.000 --> 00:00:07.000
<c>This</c> is <00:00:05.500><c>tagged</c>
"""

def test_parse_vtt_extracts_segments():
    segs = parse_vtt(SAMPLE_VTT)
    assert len(segs) > 0
    assert all('offset_sec' in s and 'text' in s for s in segs)

def test_parse_vtt_removes_tags():
    segs = parse_vtt(SAMPLE_VTT)
    for s in segs:
        assert '<c>' not in s['text']
        assert '<' not in s['text']

def test_parse_vtt_skips_empty():
    segs = parse_vtt(SAMPLE_VTT)
    assert all(s['text'].strip() for s in segs)

def test_deduplicate_removes_consecutive_duplicates():
    segs = [
        {'offset_sec': 1.0, 'text': 'Hello world'},
        {'offset_sec': 3.01, 'text': 'Hello world'},
        {'offset_sec': 5.0, 'text': 'This is a test'},
    ]
    result = deduplicate_segments(segs)
    assert len(result) == 2
    assert result[0]['text'] == 'Hello world'
    assert result[1]['text'] == 'This is a test'
