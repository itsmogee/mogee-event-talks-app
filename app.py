import re
import time
from datetime import datetime, timezone
import requests
import feedparser
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache
cache = {
    "data": None,
    "last_fetched": None,
    "expiry_seconds": 300  # Cache for 5 minutes
}

def clean_plain_text(html_content):
    """Helper to convert HTML content to clean plain text for tweets."""
    # Strip HTML tags
    text = re.sub(r'<[^>]+>', '', html_content)
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def parse_release_notes():
    """Fetches and parses the BigQuery release notes feed."""
    try:
        # Use requests to fetch with a timeout
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
        
        # Parse feed content
        feed = feedparser.parse(response.content)
        
        parsed_entries = []
        
        for entry in feed.entries:
            date_str = entry.get('title', 'Unknown Date')
            updated_iso = entry.get('updated', '')
            
            # Try to get content value, fallback to summary
            content_val = ""
            if hasattr(entry, 'content') and entry.content:
                content_val = entry.content[0].value
            elif hasattr(entry, 'summary') and entry.summary:
                content_val = entry.summary
                
            entry_link = entry.get('link', 'https://cloud.google.com/bigquery/docs/release-notes')
            entry_id = entry.get('id', '')
            
            items = []
            
            if not content_val:
                # Fallback if no content
                items.append({
                    "id": f"{entry_id}#item-0",
                    "type": "Update",
                    "content": "No content details provided.",
                    "plain_text": "No content details provided.",
                    "link": entry_link
                })
            elif '<h3>' not in content_val:
                # Single item entry without type headers
                items.append({
                    "id": f"{entry_id}#item-0",
                    "type": "Update",
                    "content": content_val,
                    "plain_text": clean_plain_text(content_val),
                    "link": entry_link
                })
            else:
                # Multiple items split by <h3> headings
                # Use regex to find type headers and text following them
                matches = list(re.finditer(r'<h3>(.*?)</h3>(.*?)(?=<h3>|$)', content_val, re.DOTALL))
                for idx, match in enumerate(matches):
                    type_name = match.group(1).strip()
                    body_html = match.group(2).strip()
                    items.append({
                        "id": f"{entry_id}#item-{idx}",
                        "type": type_name,
                        "content": body_html,
                        "plain_text": clean_plain_text(body_html),
                        "link": entry_link
                    })
            
            parsed_entries.append({
                "date": date_str,
                "updated_iso": updated_iso,
                "items": items
            })
            
        return {
            "title": feed.feed.get('title', 'BigQuery Release Notes'),
            "link": feed.feed.get('link', 'https://cloud.google.com/bigquery/docs/release-notes'),
            "entries": parsed_entries,
            "success": True
        }
        
    except Exception as e:
        print(f"Error fetching or parsing feed: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    now = time.time()
    
    # Check if cache is valid
    if (not force_refresh and 
        cache["data"] is not None and 
        cache["last_fetched"] is not None and 
        (now - cache["last_fetched"]) < cache["expiry_seconds"]):
        
        return jsonify({
            "source": "cache",
            "last_fetched": datetime.fromtimestamp(cache["last_fetched"], timezone.utc).isoformat(),
            **cache["data"]
        })
        
    # Fetch and parse
    data = parse_release_notes()
    
    if data.get("success"):
        cache["data"] = data
        cache["last_fetched"] = now
        return jsonify({
            "source": "network",
            "last_fetched": datetime.fromtimestamp(now, timezone.utc).isoformat(),
            **data
        })
    else:
        # If network fetch fails, fallback to cache if available
        if cache["data"] is not None:
            return jsonify({
                "source": "stale_cache_fallback",
                "last_fetched": datetime.fromtimestamp(cache["last_fetched"], timezone.utc).isoformat(),
                "warning": "Network fetch failed. Serving stale cache.",
                **cache["data"]
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": data.get("error", "Failed to fetch release notes")
            }), 500

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
