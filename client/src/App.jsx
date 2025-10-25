import { useState, useEffect } from 'react';
import UploadPage from './components/UploadPage';
import ProcessingPage from './components/ProcessingPage';
import ResultsPage from './components/ResultsPage';
import BrandSelector from './components/BrandSelector';
import { brandService } from './services/brandService';
import './App.css';

function App() {
  const [page, setPage] = useState('upload');
  const [jobId, setJobId] = useState(null);
  const [results, setResults] = useState(null);
  const [brandLoaded, setBrandLoaded] = useState(false);

  useEffect(() => {
    // Load brand configuration on app initialization
    async function initializeBrand() {
      const brand = await brandService.loadBrandConfig();
      brandService.applyBrandTheming(brand);
      setBrandLoaded(true);
    }
    initializeBrand();
  }, []);

  const handleUploadComplete = (id) => {
    setJobId(id);
    setPage('processing');
  };

  const handleProcessingComplete = (data) => {
    setResults(data);
    setPage('results');
  };

  const handleReset = () => {
    setPage('upload');
    setJobId(null);
    setResults(null);
  };

  if (!brandLoaded) {
    return (
      <div className="app loading-brand">
        <div className="loading-spinner">Loading brand configuration...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <BrandSelector />
      {page === 'upload' && (
        <UploadPage onComplete={handleUploadComplete} />
      )}
      {page === 'processing' && (
        <ProcessingPage jobId={jobId} onComplete={handleProcessingComplete} />
      )}
      {page === 'results' && (
        <ResultsPage results={results} onReset={handleReset} jobId={jobId} />
      )}
    </div>
  );
}

export default App;
