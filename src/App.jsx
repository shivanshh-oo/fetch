import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import ResultsPage from './components/ResultsPage';
import Toast from './components/Toast';

export default function App() {
  const [currentPage, setCurrentPage] = useState('landing'); 
  const [activeJobId, setActiveJobId] = useState(null);
  const [activeMedia, setActiveMedia] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '' });

  const triggerToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast({ show: false, message: '' });
    }, 3200);
  };

  const handleResolveSuccess = (jobId, mediaResult) => {
    setActiveJobId(jobId);
    setActiveMedia(mediaResult);
    setCurrentPage('results');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoHome = () => {
    setCurrentPage('landing');
    setActiveJobId(null);
    setActiveMedia(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <div className="bg-dots"></div>

      {}
      <nav>
        <a className="nav-logo" onClick={handleGoHome}>
          FETC<span>H</span>
        </a>
        <div className="nav-links">
          <button onClick={handleGoHome}>Home</button>
          <button onClick={() => triggerToast('Supported: YouTube, Instagram, Facebook, TikTok, X')}>
            Supported Platforms
          </button>
          <button onClick={() => triggerToast('FETCH media extractor v1.0 operational')}>
            System Status
          </button>
        </div>
        <div className="nav-right" aria-label="Menu" onClick={() => triggerToast('FETCH — All-in-One Downloader')}>
          <i className="fas fa-bars"></i>
        </div>
      </nav>

      {}
      {currentPage === 'landing' ? (
        <LandingPage onResolveSuccess={handleResolveSuccess} />
      ) : (
        <ResultsPage
          jobId={activeJobId}
          mediaData={activeMedia}
          onBack={handleGoHome}
          onTriggerToast={triggerToast}
        />
      )}

      {}
      <Toast show={toast.show} message={toast.message} />
    </>
  );
}
