from src.parsers.twitter import extract_tweet_id, snowflake_to_utc

def test_extract_tweet_id_standard():
    url = "https://twitter.com/realDonaldTrump/status/1234567890123456789"
    assert extract_tweet_id(url) == "1234567890123456789"

def test_extract_tweet_id_x_domain():
    url = "https://x.com/realDonaldTrump/status/1234567890123456789"
    assert extract_tweet_id(url) == "1234567890123456789"

def test_snowflake_to_utc_known_value():
    tweet_id = 1907851771975233700
    dt = snowflake_to_utc(tweet_id)
    assert dt.year >= 2024
