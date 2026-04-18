import email
from email import policy
import re
from typing import Dict, List, Any
import uuid

# Robust Regex Patterns for URLs and IPv4s
URL_REGEX = re.compile(r'https?://[a-zA-Z0-9.\-]+(?:/[^\s<>\'"]*)?')
IPV4_REGEX = re.compile(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b')

def extract_indicators(text: str) -> List[Dict[str, str]]:
    """Extracts URLs and IPs from a string, returning unique indicators."""
    indicators = []
    seen = set()
    
    IGNORED_EXTS = ('.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp', '.css', '.js', '.woff', '.woff2')
    
    # Extract URLs
    for url in URL_REGEX.findall(text):
        url = url.strip()
        
        # Discard URL if it appears to be a static image/asset
        base_url = url.lower().split('?')[0].split('#')[0]
        if any(base_url.endswith(ext) for ext in IGNORED_EXTS):
            continue
            
        if url not in seen:
            seen.add(url)
            indicators.append({"type": "URL", "value": url})
            
    # Extract IPs
    for ip in IPV4_REGEX.findall(text):
        # Validate octets
        parts = ip.split('.')
        valid = all(0 <= int(part) <= 255 for part in parts)
        if valid and ip not in seen:
            seen.add(ip)
            indicators.append({"type": "IP", "value": ip})
            
    return indicators

def parse_eml(file_content: bytes) -> Dict[str, Any]:
    """
    Parses an RFC822 email (.eml/.msg/.mbox) and extracts:
    - Message-ID
    - Sender
    - Subject
    - Malicious Links / IPs from the textual body.
    """
    msg = email.message_from_bytes(file_content, policy=policy.default)
    
    raw_message_id = msg.get("Message-ID", "")
    message_id = str(raw_message_id).strip('<>') if raw_message_id else f"generated-{uuid.uuid4()}@no-id.local"
    
    subject = str(msg.get("Subject", "No Subject"))
    sender = str(msg.get("From", "Unknown Sender"))
    
    body_text = ""
    
    # Walk the multipart tree to find text and HTML bodies
    for part in msg.walk():
        if part.is_multipart():
            continue
            
        content_type = part.get_content_type()
        if content_type in ['text/plain', 'text/html']:
            payload = part.get_payload(decode=True)
            if payload:
                charset = part.get_content_charset() or 'utf-8'
                try:
                    body_text += payload.decode(charset, errors='replace') + " "
                except LookupError: # Unknown encoding
                    body_text += payload.decode('utf-8', errors='replace') + " "

    indicators = extract_indicators(body_text)
    
    return {
        "message_id": message_id,
        "subject": subject,
        "sender": sender,
        "indicators": indicators
    }
