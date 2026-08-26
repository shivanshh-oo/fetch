import React, { useState } from 'react';

export default function ResultsPage({ jobId, mediaData, onBack, onTriggerToast }) {
  const {
    platform, title, author, duration, thumbnail,
    videos = [], audioStreams = [],
    audioFormats = ['MP3', 'M4A'],
    audioQualities = ['320 kbps', '192 kbps', '128 kbps']
  } = mediaData || {};

  const [selectedVideo, setSelectedVideo] = useState(videos[0] || null);
  const [selectedFormat, setSelectedFormat] = useState(audioFormats[0] || 'MP3');
  const [selectedQuality, setSelectedQuality] = useState(audioQualities[0] || '320 kbps');
  const [imgError, setImgError] = useState(false);
  const [dlState, setDlState] = useState({ video: false, audio: false });

  const fallbackThumb = `https://picsum.photos/seed/${encodeURIComponent(title || jobId || 'fetch')}/800/450`;
  const sourceUrl = mediaData?._sourceUrl || '';

  const triggerDownload = (href) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = href;
    document.body.appendChild(iframe);
    
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 120000);
  };

  const handleDownloadVideo = () => {
    if (!sourceUrl && !selectedVideo?.url) {
      onTriggerToast('No download URL available.');
      return;
    }

    const safeName = (title || 'FETCH_video').replace(/[^\w\s-]/g, '').trim().substring(0, 60);
    const heightMatch = (selectedVideo?.quality || '').match(/(\d{3,4})p?/);
    const height = heightMatch ? heightMatch[1] : '0';

    setDlState(s => ({ ...s, video: true }));
    onTriggerToast(`Preparing ${selectedVideo?.quality || 'HD'} video — check notifications shortly…`);

    const href = `/api/v1/download/file?url=${encodeURIComponent(sourceUrl)}&title=${encodeURIComponent(safeName)}&audio=0&height=${height}`;

    triggerDownload(href);

    setTimeout(() => setDlState(s => ({ ...s, video: false })), 5000);
  };

  const handleDownloadAudio = () => {
    const safeName = (title || 'FETCH_audio').replace(/[^\w\s-]/g, '').trim().substring(0, 60);
    const nativeAudio = audioStreams[0];

    setDlState(s => ({ ...s, audio: true }));

    if (nativeAudio?.url) {

      onTriggerToast(`Downloading ${nativeAudio.extension?.toUpperCase() || 'MP3'} audio…`);
      triggerDownload(nativeAudio.url);
    } else if (sourceUrl) {

      onTriggerToast('Extracting audio — check notifications shortly…');
      const href = `/api/v1/download/file?url=${encodeURIComponent(sourceUrl)}&title=${encodeURIComponent(safeName)}&audio=1`;
      triggerDownload(href);
    } else {
      onTriggerToast('No audio stream available for this media.');
    }

    setTimeout(() => setDlState(s => ({ ...s, audio: false })), 5000);
  };

  return (
    <main className="page page-results" id="pageResults">


      <div className="results-topbar">
        <button className="back-btn" onClick={onBack}>
          <i className="fas fa-arrow-left"></i> New download
        </button>
        <div className="media-found">Media found</div>
        <div className={`platform-detected ${platform?.cls || 'yt'}`}>
          <i className={platform?.icon || 'fab fa-youtube'}></i>&nbsp;{platform?.label || 'Platform'} detected
        </div>
      </div>


      <div className="preview-card">
        <div className="card-label">Video Preview</div>
        <div className="preview-image">
          <img
            key={thumbnail}
            src={(!imgError && thumbnail) ? thumbnail : fallbackThumb}
            alt={title || 'Media thumbnail'}
            onError={() => setImgError(true)}
          />
          <div
            className="play-overlay"
            onClick={() => selectedVideo?.url && window.open(selectedVideo.url, '_blank')}
            title="Preview in new tab"
          >
            <div className="play-btn-box"><i className="fas fa-play"></i></div>
          </div>
          <div className="duration-tag">{duration || '00:00'}</div>
        </div>

        <div className="preview-info">
          <h2>{title || 'Media Title'}</h2>
          <div className="preview-meta">
            <span><i className={platform?.icon || 'fas fa-video'}></i>&nbsp;{platform?.label || 'Social Media'}</span>
            <span className="meta-sep">&middot;</span>
            <span>{duration || '00:00'}</span>
            <span className="meta-sep">&middot;</span>
            <span>{author || 'Creator'}</span>
          </div>
        </div>
      </div>


      <div className="download-row">


        <div className="dl-card">
          <div className="card-label yellow">Download Video</div>

          {videos.length > 0 ? (
            <div className="dl-options">
              {videos.map((v, i) => (
                <div
                  key={v.id || i}
                  className={`dl-opt ${selectedVideo?.id === v.id ? 'selected' : ''}`}
                  onClick={() => setSelectedVideo(v)}
                  tabIndex={0}
                  role="button"
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSelectedVideo(v)}
                >
                  <span className="dl-opt-quality">{v.quality}</span>
                  <span className="dl-opt-detail">{v.detail}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ padding: '16px 0', fontSize: '0.8rem', color: '#6B6560' }}>
              No video formats could be extracted.
            </p>
          )}


          {dlState.video && (
            <div style={{ padding: '8px 0', fontSize: '0.72rem', color: '#6B6560', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="btn-spinner" style={{ display: 'block', border: '2.5px solid #DED2BD', borderTopColor: '#1A1A1A', width: 14, height: 14, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}></div>
              Video is being prepared…
            </div>
          )}

          <button
            className="dl-btn"
            onClick={handleDownloadVideo}
            disabled={dlState.video}
          >
            {dlState.video
              ? <><div className="btn-spinner" style={{ display: 'block' }}></div>&nbsp;Preparing…</>
              : <><i className="fas fa-download"></i> Download Video</>
            }
          </button>
        </div>


        <div className="dl-card">
          <div className="card-label pink">Download Audio</div>

          {audioStreams.length > 0 && (
            <div style={{ padding: '10px 0 6px', fontSize: '0.72rem', color: '#4A7A40', fontWeight: 700 }}>
              <i className="fas fa-check-circle"></i>&nbsp;Native audio stream available
            </div>
          )}

          <div className="dl-sublabel">Format</div>
          <div className="dl-options small">
            {audioFormats.map(fmt => (
              <div
                key={fmt}
                className={`dl-opt-sm ${selectedFormat === fmt ? 'selected' : ''}`}
                onClick={() => setSelectedFormat(fmt)}
                tabIndex={0}
                role="button"
              >
                {fmt}
              </div>
            ))}
          </div>

          <div className="dl-sublabel">Quality</div>
          <div className="dl-options three-col">
            {audioQualities.map(q => (
              <div
                key={q}
                className={`dl-opt-sm ${selectedQuality === q ? 'selected' : ''}`}
                onClick={() => setSelectedQuality(q)}
                tabIndex={0}
                role="button"
              >
                {q}
              </div>
            ))}
          </div>

          {dlState.audio && (
            <div style={{ padding: '8px 0', fontSize: '0.72rem', color: '#6B6560', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="btn-spinner" style={{ display: 'block', border: '2.5px solid #DED2BD', borderTopColor: '#1A1A1A', width: 14, height: 14, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}></div>
              Audio is being extracted…
            </div>
          )}

          <button
            className="dl-btn"
            onClick={handleDownloadAudio}
            disabled={dlState.audio}
          >
            {dlState.audio
              ? <><div className="btn-spinner" style={{ display: 'block' }}></div>&nbsp;Extracting…</>
              : <><i className="fas fa-headphones"></i> Download Audio</>
            }
          </button>
        </div>

      </div>
    </main>
  );
}
