import json, os
from src.writer import load_data, save_event

def test_save_and_load(tmp_path, monkeypatch):
    monkeypatch.setattr('src.writer.DATA_FILE', str(tmp_path / 'data.json'))

    event = {
        'id': 'test123',
        'source': 'youtube_live',
        'title': 'Test Event',
        'broadcast_at': '2026-04-01T21:00:00+00:00',
        'indices': {'rage': 50, 'trump_risk_score': 45},
        'top_volatility': [],
    }
    save_event(event)
    data = load_data()
    assert len(data['events']) == 1
    assert data['events'][0]['id'] == 'test123'

def test_save_deduplicates_by_id(tmp_path, monkeypatch):
    monkeypatch.setattr('src.writer.DATA_FILE', str(tmp_path / 'data.json'))

    event = {'id': 'dup', 'title': 'First', 'broadcast_at': '2026-04-01T00:00:00+00:00',
             'indices': {}, 'top_volatility': []}
    save_event(event)
    event2 = {**event, 'title': 'Second'}
    save_event(event2)
    data = load_data()
    assert len(data['events']) == 1
    assert data['events'][0]['title'] == 'Second'
