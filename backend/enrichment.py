import urllib.request
import urllib.parse
import json
import database
import models

def get_setting(db, key):
    res = db.query(models.Setting).filter(models.Setting.key == key).first()
    return res.value if res else None

def lookup_urlhaus(url: str, api_key: str = None) -> dict:
    """Queries URLhaus to see if a specific URL is actively hosting malware."""
    data = urllib.parse.urlencode({'url': url}).encode('utf-8')
    headers = {}
    if api_key:
        headers = {'Auth-Key': api_key}
    req = urllib.request.Request("https://urlhaus-api.abuse.ch/v1/url/", data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            result = json.loads(response.read().decode())
            if result.get("query_status") == "ok":
                return {"score": 99, "status": "success", "details": "Found in database"}
            else:
                return {"score": 0, "status": "success", "details": "Not listed"}
    except Exception as e:
        print(f"URLhaus lookup failed for {url}: {e}")
        return {"score": None, "status": "error", "details": str(e)}

def lookup_threatfox(ip: str, api_key: str = None) -> dict:
    """Queries ThreatFox to see if an IP is a known C2 server."""
    payload = json.dumps({"query": "search_ioc", "search_term": ip}).encode('utf-8')
    headers = {'Content-Type': 'application/json'}
    if api_key:
        headers['Auth-Key'] = api_key
    req = urllib.request.Request("https://threatfox-api.abuse.ch/api/v1/", data=payload, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            result = json.loads(response.read().decode())
            if result.get("query_status") == "ok":
                return {"score": 80, "status": "success", "details": "High Severity C2/Botnet IP"}
            else:
                return {"score": 0, "status": "success", "details": "Not listed"}
    except Exception as e:
        print(f"ThreatFox lookup failed for {ip}: {e}")
        return {"score": None, "status": "error", "details": str(e)}

def lookup_virustotal(value: str, api_key: str = None) -> dict:
    """Queries VirusTotal for URL/IP reputation score."""
    if not api_key:
        import os
        api_key = os.getenv("VT_API_KEY")
    if not api_key:
        return {"score": None, "status": "error", "details": "Missing API Key"}

    import base64
    # For URLs, VT expects base64 encoded URL without padding
    target_id = base64.urlsafe_b64encode(value.encode()).decode().strip("=")
    
    url = f"https://www.virustotal.com/api/v3/urls/{target_id}"
    req = urllib.request.Request(url, headers={'x-apikey': api_key})
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            result = json.loads(response.read().decode())
            stats = result.get("data", {}).get("attributes", {}).get("last_analysis_stats", {})
            malicious = stats.get("malicious", 0)
            suspicious = stats.get("suspicious", 0)
            
            # Normalize to 0-99
            # If 5+ engines say malicious, it's 99.
            total_hits = malicious + suspicious
            score = min(total_hits * 15, 99)
            return {"score": score, "status": "success", "details": f"{total_hits} malicious/suspicious hits"}
    except urllib.error.HTTPError as e:
        if e.code == 404:
             return {"score": 0, "status": "success", "details": "Not found in VT"}
        return {"score": None, "status": "error", "details": f"HTTP {e.code}"}
    except Exception as e:
        print(f"VirusTotal lookup failed for {value}: {e}")
        return {"score": None, "status": "error", "details": str(e)}

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
            
        # Fetch settings
        urlhaus_key = get_setting(db, "urlhaus_api_key")
        threatfox_key = get_setting(db, "threatfox_api_key")
        vt_key = get_setting(db, "vt_api_key")

        scores = []
        details = {}
        if ind.indicator_type == "URL":
            ind.enrichment_details = {"URLhaus": {"status": "pending", "details": "Scanning..."}, "VirusTotal": {"status": "pending", "details": "Scanning..."}}
            db.commit()

            uh_res = lookup_urlhaus(ind.value, urlhaus_key)
            vt_res = lookup_virustotal(ind.value, vt_key)
            
            details = {
                "URLhaus": uh_res,
                "VirusTotal": vt_res
            }
            scores.extend([uh_res.get("score"), vt_res.get("score")])
        elif ind.indicator_type == "IP":
            ind.enrichment_details = {"ThreatFox": {"status": "pending", "details": "Scanning..."}, "VirusTotal": {"status": "pending", "details": "Scanning..."}}
            db.commit()

            tf_res = lookup_threatfox(ind.value, threatfox_key)
            vt_res = lookup_virustotal(ind.value, vt_key)
            
            details = {
                "ThreatFox": tf_res,
                "VirusTotal": vt_res
            }
            scores.extend([tf_res.get("score"), vt_res.get("score")])
            
        ind.enrichment_details = details
        # Filter None and take the max
        valid_scores = [s for s in scores if s is not None]
        if valid_scores:
            ind.vt_score = max(valid_scores)
        db.commit()
    except Exception as e:
        print(f"Background enrichment failed for indicator {indicator_id}: {e}")
    finally:
        db.close()
