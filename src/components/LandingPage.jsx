import React, { useState, useEffect } from 'react';

const PLATFORM_MATCHERS = [
  { key: 'youtube', label: 'YouTube', cls: 'yt', icon: 'fab fa-youtube', regex: /(?:youtube\.com|youtu\.be)/i },
  { key: 'instagram', label: 'Instagram', cls: 'ig', icon: 'fab fa-instagram', regex: /instagram\.com/i },
  { key: 'facebook', label: 'Facebook', cls: 'fb', icon: 'fab fa-facebook-f', regex: /(?:facebook\.com|fb\.watch)/i },
  { key: 'tiktok', label: 'TikTok', cls: 'tt', icon: 'fab fa-tiktok', regex: /tiktok\.com/i },
  { key: 'twitter', label: 'Twitter / X', cls: 'tw', icon: 'fab fa-x-twitter', regex: /(?:twitter\.com|x\.com)/i },
];

export default function LandingPage({ onResolveSuccess }) {
  const [url, setUrl] = useState('');
  const [detected, setDetected] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Real-time client side detection
  useEffect(() => {
    setErrorMsg('');
    const trimmed = url.trim();
    if (!trimmed) {
      setDetected(null);
      return;
    }

    const match = PLATFORM_MATCHERS.find(p => p.regex.test(trimmed));
    if (match) {
      setDetected(match);
    } else {
      setDetected(null);
    }
  }, [url]);

  const handleFetch = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setErrorMsg('Please paste a video or audio link to get started.');
      return;
    }

    if (!detected) {
      setErrorMsg('Unsupported link — paste a valid YouTube, Instagram, Facebook, TikTok, or X link.');
      return;
    }

    setErrorMsg('');
    setLoading(true);
    setProgress(15);

    try {
      // 1. Submit resolution job to backend API
      const res = await fetch('/api/v1/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to initialize resolution job');
      }

      const jobId = data.jobId;
      setProgress(45);

      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await fetch(`/api/v1/jobs/${jobId}`);
          const statusData = await statusRes.json();

          if (statusData.status === 'completed') {
            clearInterval(pollInterval);
            setProgress(100);
            setTimeout(() => {
              setLoading(false);
              onResolveSuccess(jobId, statusData.result);
            }, 350);
          } else if (statusData.status === 'failed') {
            clearInterval(pollInterval);
            setLoading(false);
            setErrorMsg(statusData.error || 'Failed to extract media metadata.');
          } else {
            setProgress(prev => Math.min(prev + 15, 85));
          }
        } catch (pollErr) {
          if (attempts > 10) {
            clearInterval(pollInterval);
            setLoading(false);
            setErrorMsg('Extraction timed out. Please try again.');
          }
        }
      }, 300);

    } catch (err) {
      setLoading(false);
      setErrorMsg(err.message || 'Server error occurred while resolving link.');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleFetch();
  };

  return (
    <main className="page page-landing" id="pageLanding">
      <div className="hero-text">
        <h1>Download media.<br />No hassle.</h1>
        <p>Paste a link to fetch video qualities or extract MP3 audio in seconds.</p>
      </div>

      <div className="input-section">
        {}
        <div className="support-static">
          <div className="sf-title">Supported Everywhere</div>
          <div className="sf-platforms">
            <span><i className="fab fa-youtube"></i> YouTube</span>
            <span className="sf-sep">&bull;</span>
            <span><i className="fab fa-instagram"></i> Instagram</span>
            <span className="sf-sep">&bull;</span>
            <span><i className="fab fa-facebook-f"></i> Facebook</span>
            <span className="sf-sep">&bull;</span>
            <span><i className="fab fa-tiktok"></i> TikTok</span>
            <span className="sf-sep">&bull;</span>
            <span><i className="fab fa-x-twitter"></i> X</span>
          </div>
        </div>

        <div className="input-card" id="inputCard">
          <div className="input-label">Media URL</div>
          <div className="input-wrap">
            <input
              type="url"
              className="link-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste Instagram, YouTube, TikTok or Facebook link…"
              autoComplete="off"
              spellCheck="false"
              aria-label="Paste media URL"
            />
            <div className={`detect-badge ${detected ? `show ${detected.cls}` : ''}`}>
              <i className={detected?.icon || 'fas fa-link'}></i>
              <span>{detected?.label || 'Link'}</span>
            </div>
          </div>

          {errorMsg && (
            <div className="error-box">
              <i className="fas fa-triangle-exclamation"></i>
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            className={`fetch-btn ${loading ? 'loading' : ''}`}
            onClick={handleFetch}
            disabled={loading}
          >
            <div className="btn-spinner"></div>
            <span className="btn-label">Fetch</span>
            <i className="fas fa-arrow-right btn-arrow"></i>
          </button>

          {loading && (
            <div className="loading-overlay">
              <div className="loading-text">
                FETCHING MEDIA<span className="blink">_</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="steps-section">
        <div className="step-card">
          <div className="step-num" style={{ background: 'var(--yellow)' }}>1</div>
          <div className="step-text">Paste link</div>
        </div>
        <div className="step-card">
          <div className="step-num" style={{ background: 'var(--pink)' }}>2</div>
          <div className="step-text">Fetch media</div>
        </div>
        <div className="step-card">
          <div className="step-num" style={{ background: 'var(--blue)' }}>3</div>
          <div className="step-text">Choose video or audio</div>
        </div>
      </section>
    </main>
  );
}
