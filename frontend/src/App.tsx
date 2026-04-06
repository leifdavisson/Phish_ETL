import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('submit');
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [sysStatus, setSysStatus] = useState<any>(null);
  const [edlLogs, setEdlLogs] = useState([]);
  const [settings, setSettings] = useState<any>({ urlhaus_api_key: '', threatfox_api_key: '', vt_api_key: '' });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  
  // Authentication State
  const [token, setToken] = useState(localStorage.getItem('admin_token') || '');
  const [passwordInput, setPasswordInput] = useState('');
  
  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{type: 'error' | 'success', text: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    if (activeTab === 'review') fetchQueue();
    else if (activeTab === 'threatdb') fetchHistory();
    else if (activeTab === 'status') {
      fetchStatus();
      fetchSettings();
    }
  }, [activeTab, token]);

  const authFetch = async (url: string, options: any = {}) => {
    const headers = { ...(options.headers || {}), 'Authorization': `Bearer ${token}` };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      setToken('');
      localStorage.removeItem('admin_token');
      setActiveTab('submit');
    }
    return res;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput })
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        localStorage.setItem('admin_token', data.token);
        setActiveTab('review');
        setPasswordInput('');
      } else {
        alert("Invalid Password");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('admin_token');
    setActiveTab('submit');
  };

  const fetchQueue = async () => {
    try {
      const res = await authFetch('/api/queue');
      const data = await res.json();
      if(data.queue) setQueue(data.queue);
    } catch (err) { console.error(err); }
  };

  const fetchHistory = async () => {
    try {
      const res = await authFetch('/api/history');
      const data = await res.json();
      if(data.history) setHistory(data.history);
    } catch (err) { console.error(err); }
  };

  const fetchStatus = async () => {
    try {
      const res = await authFetch('/api/status');
      const data = await res.json();
      setSysStatus(data);
      
      const logRes = await authFetch('/api/logs/edl');
      const logData = await logRes.json();
      setEdlLogs(logData);
    } catch (err) { console.error(err); }
  };

  const fetchSettings = async () => {
    try {
      const res = await authFetch('/api/settings');
      const data = await res.json();
      // Merge with defaults to ensure keys exist
      setSettings((prev: any) => ({ ...prev, ...data }));
    } catch (err) { console.error(err); }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await authFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      alert("Settings saved successfully!");
      fetchSettings();
      fetchStatus();
    } catch (err) { console.error(err); }
    finally { setIsSavingSettings(false); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStatusMsg(null);
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setStatusMsg(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch('/api/ingest', { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      
      if (data.status === 'success') {
        setStatusMsg({ type: 'success', text: `Success! ${data.indicators} indicators extracted.` });
      } else if (data.status === 'duplicate') {
        setStatusMsg({ type: 'error', text: 'Duplicate Email Detected. No new indicators added.' });
      } else {
        setStatusMsg({ type: 'success', text: data.message || 'Analyzed successfully.' });
      }
      setSelectedFile(null); 
      if(fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Upload failed: ${err.message}` });
    } finally {
      setIsUploading(false);
    }
  };

  const handleVerdict = async (id: number, status: string) => {
    try {
      await authFetch(`/api/verdict/${id}?status=${status}`, { method: 'POST' });
      setQueue(queue.filter((q: any) => q.id !== id));
    } catch (err) { console.error(err); }
  };

  const handleUndo = async (id: number) => {
    try {
      await authFetch(`/api/verdict/${id}?status=PENDING`, { method: 'POST' });
      setHistory(history.filter((h: any) => h.id !== id));
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to permanently delete this indicator?")) return;
    try {
      await authFetch(`/api/indicator/${id}`, { method: 'DELETE' });
      setHistory(history.filter((h: any) => h.id !== id));
      setQueue(queue.filter((q: any) => q.id !== id));
    } catch (err) { console.error(err); }
  };

  const handleClearDB = async () => {
    if (!window.prompt("DANGER: Type 'CLEAR' to wipe the database.")?.match(/^CLEAR$/)) return;
    try {
      await authFetch(`/api/clear`, { method: 'DELETE' });
      setHistory([]);
      setQueue([]);
      fetchStatus();
      setStatusMsg({ type: 'success', text: 'Database wiped successfully.' });
    } catch (err) { console.error(err); }
  };

  const renderOsintScore = (score: number | null) => {
    if (score === null) return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Scanning...</span>;
    if (score === 0) return <span style={{ color: 'var(--text-muted)' }}>0 (Clean / Unknown)</span>;
    if (score >= 80) return <span style={{ color: '#ff7b72', fontWeight: 'bold' }}>{score} / 99 (Malicious)</span>;
    if (score >= 50) return <span style={{ color: '#d29922', fontWeight: 'bold' }}>{score} / 99 (Suspicious)</span>;
    return <span>{score} / 99</span>;
  };

  const renderSourceBreakdown = (details: any) => {
    if (!details) return <span style={{ color: 'var(--text-muted)' }}>N/A</span>;
    return (
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {Object.entries(details).map(([source, data]: [string, any]) => {
          let bgColor = 'var(--bg-secondary)'; // default
          let color = 'white';
          
          if (data.status === 'success') { bgColor = 'rgba(46, 160, 67, 0.2)'; color = '#3fb950'; }
          else if (data.status === 'error') { bgColor = 'rgba(215, 58, 73, 0.2)'; color = '#ff7b72'; }
          else if (data.status === 'pending') { bgColor = 'rgba(210, 153, 34, 0.2)'; color = '#d29922'; }

          return (
            <div key={source} title={data.details} style={{
              background: bgColor, color: color, padding: '4px 8px', borderRadius: '4px', fontSize: '0.75em', border: `1px solid ${color}`, cursor: 'help', display: 'flex', flexDirection: 'column'
            }}>
              <strong>{source}</strong>
              <span style={{ fontSize: '0.9em', filter: 'brightness(1.5)' }}>
                {data.status === 'pending' ? 'Scanning...' : (data.score !== undefined ? `${data.score} / 99` : 'Error')}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
            <h1 className="title" style={{ textAlign: 'left' }}>Phish_ETL</h1>
            <p className="subtitle" style={{ textAlign: 'left', marginBottom: '20px' }}>Automated Phishing Analysis & Triage</p>
        </div>
        {token ? (
            <button onClick={handleLogout} style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Logout Admin</button>
        ) : (
            <button onClick={() => setActiveTab('login')} style={{ background: 'transparent', color: 'var(--accent-color)', border: '1px solid var(--accent-color)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Admin Login</button>
        )}
      </div>
      
      <div className="tab-container" style={{ justifyContent: 'flex-start' }}>
        <button className={`tab-btn ${activeTab === 'submit' ? 'active' : ''}`} onClick={() => setActiveTab('submit')}>Teacher Submission</button>
        {token && (
          <>
            <button className={`tab-btn ${activeTab === 'review' ? 'active' : ''}`} onClick={() => setActiveTab('review')}>Admin Review Queue</button>
            <button className={`tab-btn ${activeTab === 'threatdb' ? 'active' : ''}`} onClick={() => setActiveTab('threatdb')}>Threat Database</button>
            <button className={`tab-btn ${activeTab === 'howto' ? 'active' : ''}`} onClick={() => setActiveTab('howto')}>Integration Guides</button>
            <button className={`tab-btn ${activeTab === 'status' ? 'active' : ''}`} onClick={() => setActiveTab('status')}>System Analytics</button>
          </>
        )}
      </div>

      {activeTab === 'login' && !token && (
        <div className="panel" style={{ maxWidth: '400px', margin: '40px auto', textAlign: 'center' }}>
          <h2>Admin Authentication</h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
            <input 
              type="password" 
              placeholder="Enter Admin Password" 
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              style={{ padding: '10px', borderRadius: '6px', background: 'var(--bg-color)', border: '1px solid var(--border-color)', color: 'white', fontSize: '1rem' }}
              autoFocus
            />
            <button type="submit" className="upload-btn" style={{ marginTop: '0' }}>Login securely</button>
          </form>
        </div>
      )}

      {activeTab === 'submit' && (
        <div className="panel">
          <div className="upload-area" onClick={() => !selectedFile && fileInputRef.current?.click()} style={{ cursor: selectedFile ? 'default' : 'pointer' }}>
            <div className="upload-icon">✉️</div>
            <h2>Upload Suspicious Email</h2>
            <p style={{ color: 'var(--text-muted)' }}>Drag and drop or select (.eml, .mbox, .msg)</p>
            {!selectedFile && <button className="browse-btn" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>Browse Files</button>}
            <input type="file" className="file-input" accept=".eml,.mbox,.msg" onChange={handleFileSelect} ref={fileInputRef} />
            
            {selectedFile && (
              <div className="file-name">📄 {selectedFile.name}
                <button style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setSelectedFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; }}>✖</button>
              </div>
            )}
            
            <button className="upload-btn" onClick={(e) => { e.stopPropagation(); handleUploadSubmit(); }} disabled={!selectedFile || isUploading}>
              {isUploading ? <><span className="loader"></span> Analyzing...</> : 'Submit for Analysis'}
            </button>
          </div>
          {statusMsg && ( <div className={`status-message status-${statusMsg.type}`}>{statusMsg.type === 'success' ? '✅ ' : '❌ '}{statusMsg.text}</div> )}
        </div>
      )}

      {activeTab === 'review' && token && (
        <div className="panel">
          <h2>Pending Indicators</h2>
          {queue.length === 0 ? ( <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>🎉 The queue is empty. Good job!</div> ) : (
            <table className="data-table">
              <thead><tr><th>Target Value</th><th>Source Email</th><th>Type</th><th>OSINT Confidence</th><th>Sources</th><th>Actions</th></tr></thead>
              <tbody>
                {queue.map((item: any) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: '600' }}>{item.value}</td>
                    <td style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}><strong>{item.sender}</strong><br/>{item.subject}</td>
                    <td>{item.type}</td>
                    <td>{renderOsintScore(item.score)}</td>
                    <td>{renderSourceBreakdown(item.enrichment_details)}</td>
                    <td>
                      <button className="action-btn btn-approve" onClick={() => handleVerdict(item.id, 'APPROVED')}>Publish</button>
                      <button className="action-btn btn-deny" onClick={() => handleVerdict(item.id, 'DENIED')}>Mark Safe</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'threatdb' && token && (
        <div className="panel">
          <h2>Active Threat Database</h2>
          {history.length === 0 ? ( <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No historical verdicts.</div> ) : (
            <table className="data-table">
              <thead><tr><th>Target Value</th><th>Current State</th><th>Source Context</th><th>Sources</th><th>Actions</th></tr></thead>
              <tbody>
                {history.map((item: any) => {
                  const daysOld = Math.floor((new Date().getTime() - new Date(item.submitted_at).getTime()) / (1000 * 3600 * 24));
                  const daysLeft = Math.max(0, 30 - daysOld);
                  return (
                  <tr key={item.id} style={{ opacity: item.status === 'DENIED' ? 0.6 : 1 }}>
                    <td style={{ fontWeight: '600', color: item.status === 'APPROVED' ? '#ff7b72' : 'inherit' }}>{item.value}</td>
                    <td>
                      <span style={{ background: item.status === 'APPROVED' ? 'rgba(215, 58, 73, 0.2)' : 'rgba(110, 118, 129, 0.2)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8em', fontWeight: 'bold' }}>{item.status}</span>
                      {item.status === 'APPROVED' && ( <div style={{ marginTop: '8px', fontSize: '0.8em', color: daysLeft <= 5 ? 'var(--danger)' : 'var(--text-muted)' }}>⏳ Expires in {daysLeft} days</div> )}
                    </td>
                    <td style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}><strong>{item.sender}</strong><br/>{item.subject}</td>
                    <td>{renderSourceBreakdown(item.enrichment_details)}</td>
                    <td style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button className="action-btn" style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }} onClick={() => handleUndo(item.id)}>Undo Verdict</button>
                      <button className="action-btn" style={{ background: 'var(--danger)', color: '#fff' }} onClick={() => handleDelete(item.id)}>Delete</button>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'status' && token && (
        <div className="panel">
          <h2>System Analytics</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
            <div style={{ background: 'var(--bg-color)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginTop: 0 }}>Internal Operations</h3>
              <p><strong>PostgreSQL DB:</strong> <span style={{ color: sysStatus?.internal?.postgres === 'Online' ? 'var(--success)' : 'var(--danger)' }}>{sysStatus?.internal?.postgres || 'Checking...'}</span></p>
              <p><strong>Emails Parsed:</strong> {sysStatus?.internal?.emails_parsed}</p>
              <p><strong>Indicators Tracked:</strong> {sysStatus?.internal?.indicators_tracked}</p>
            </div>
            <div style={{ background: 'var(--bg-color)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginTop: 0 }}>External OSINT</h3>
              <p><strong>URLhaus API:</strong> <span style={{ color: 'var(--success)' }}>{sysStatus?.external?.urlhaus_api}</span></p>
              <p><strong>ThreatFox API:</strong> <span style={{ color: 'var(--success)' }}>{sysStatus?.external?.threatfox_api}</span></p>
              <p><strong>VirusTotal Env:</strong> <span style={{ color: sysStatus?.external?.virustotal_api.startsWith('Configured') ? 'var(--success)' : 'var(--text-muted)' }}>{sysStatus?.external?.virustotal_api}</span></p>
            </div>
          </div>

          <div style={{ marginTop: '30px', background: 'var(--bg-color)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginTop: 0 }}>Global OSINT Settings</h3>
              <form onSubmit={handleSaveSettings} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>URLhaus API Key</label>
                      <input 
                        type="password" 
                        placeholder={settings.urlhaus_api_key || "Paste Key here..."}
                        value={(settings.urlhaus_api_key || "").includes('*') ? '' : (settings.urlhaus_api_key || "")}
                        onChange={(e) => setSettings({...settings, urlhaus_api_key: e.target.value})}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'white' }}
                      />
                  </div>
                  <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>ThreatFox API Key</label>
                      <input 
                        type="password" 
                        placeholder={settings.threatfox_api_key || "Paste Key here..."}
                        value={(settings.threatfox_api_key || "").includes('*') ? '' : (settings.threatfox_api_key || "")}
                        onChange={(e) => setSettings({...settings, threatfox_api_key: e.target.value})}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'white' }}
                      />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>VirusTotal API Key</label>
                      <input 
                        type="password" 
                        placeholder={settings.vt_api_key || "Paste Key here..."}
                        value={(settings.vt_api_key || "").includes('*') ? '' : (settings.vt_api_key || "")}
                        onChange={(e) => setSettings({...settings, vt_api_key: e.target.value})}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'white' }}
                      />
                  </div>
                  <button type="submit" disabled={isSavingSettings} className="action-btn btn-approve" style={{ width: 'fit-content' }}>
                      {isSavingSettings ? 'Saving...' : 'Update API Keys'}
                  </button>
              </form>
          </div>
          
          <h3 style={{ marginTop: '40px' }}>Firewall EDL Access Logs</h3>
          <div style={{ background: '#0d1117', padding: '15px', borderRadius: '6px', border: '1px solid #30363d', height: '200px', overflowY: 'auto' }}>
            {edlLogs.length === 0 ? ( <div style={{ color: 'var(--text-muted)' }}>No firewalls have fetched the feed yet.</div> ) : (
              <table style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead><tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}><th>Timestamp</th><th>Endpoint</th><th>Client IP</th></tr></thead>
                <tbody>
                  {edlLogs.map((l: any) => (
                    <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '8px 0', fontFamily: 'monospace' }}>{new Date(l.time).toLocaleString()}</td>
                      <td style={{ color: 'var(--accent-color)' }}>/api/feeds/edl/{l.endpoint.toLowerCase()}</td>
                      <td style={{ color: '#ff7b72' }}>{l.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'howto' && token && (
        <div className="panel" style={{ lineHeight: '1.6' }}>
          <h2>Firewall Integration Guides</h2>
          <div style={{ background: '#0d1117', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#ff7b72' }}>Palo Alto Networks (PAN-OS)</h3>
            <pre style={{ background: '#161b22', padding: '15px', borderRadius: '6px', overflowX: 'auto', border: '1px solid #30363d', color: '#c9d1d9', fontSize: '0.85rem' }}>
set external-list Phish_ETL_URLs type url http://&lt;SERVER_IP&gt;:8000/api/feeds/edl/url
set external-list Phish_ETL_IPs type ip http://&lt;SERVER_IP&gt;:8000/api/feeds/edl/ip
            </pre>
          </div>
          <div style={{ background: '#0d1117', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#ff7b72' }}>Fortinet (FortiGate)</h3>
            <pre style={{ background: '#161b22', padding: '15px', borderRadius: '6px', overflowX: 'auto', border: '1px solid #30363d', color: '#c9d1d9', fontSize: '0.85rem' }}>
config system external-block-list
    edit "Phish_ETL_URLs"
        set type url
        set resource "http://&lt;SERVER_IP&gt;:8000/api/feeds/edl/url"
    next
    edit "Phish_ETL_IPs"
        set type ip
        set resource "http://&lt;SERVER_IP&gt;:8000/api/feeds/edl/ip"
            </pre>
          </div>
        </div>
      )}

      {token && (
        <div style={{ marginTop: '60px', padding: '20px', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '15px' }}><strong>Admin Zone:</strong> Use this carefully to clear the entire database.</p>
          <button onClick={handleClearDB} style={{ background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>🚨 Clear Entire Database</button>
        </div>
      )}
    </div>
  );
}

export default App;
