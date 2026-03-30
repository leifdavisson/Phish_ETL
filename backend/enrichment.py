import urllib.request
import urllib.parse
import json
import database
import models

def lookup_urlhaus(url: str) -> int:
    """Queries URLhaus to see if a specific URL is actively hosting malware."""
    data = urllib.parse.urlencode({'url': url}).encode('utf-8')
    req = urllib.request.Request("https://urlhaus-api.abuse.ch/v1/url/", data=data)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            result = json.loads(response.read().decode())
            if result.get("query_status") == "ok":
                return 99 # Critical / Actively serving malware
            else:
                return 0 # Not listed / Unknown
    except Exception as e:
        print(f"URLhaus lookup failed for {url}: {e}")
        return None

def lookup_threatfox(ip: str) -> int:
    """Queries ThreatFox to see if an IP is a known C2 server."""
    payload = json.dumps({"query": "search_ioc", "search_term": ip}).encode('utf-8')
    req = urllib.request.Request("https://threatfox-api.abuse.ch/api/v1/", data=payload, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            result = json.loads(response.read().decode())
            if result.get("query_status") == "ok":
                return 80 # High Severity C2/Botnet IP
            else:
                return 0 # Not listed
    except Exception as e:
        print(f"ThreatFox lookup failed for {ip}: {e}")
        return None

def enrich_indicator(indicator_id: int):
    """
    Background Task: 
    Opens a localized DB session, pulls the indicator, pings the relevant OSINT,
    and updates the 0-99 score so the UI dynamically refreshes.
    """
    db = database.SessionLocal()
    try:
        ind = db.query(models.Indicator).filter(models.Indicator.id == indicator_id).first()
        if not ind:
            return
            
        score = None
        if ind.indicator_type == "URL":
            score = lookup_urlhaus(ind.value)
        elif ind.indicator_type == "IP":
            score = lookup_threatfox(ind.value)
            
        if score is not None:
            ind.vt_score = score
            db.commit()
    except Exception as e:
        print(f"Background enrichment failed for indicator {indicator_id}: {e}")
    finally:
        db.close()
