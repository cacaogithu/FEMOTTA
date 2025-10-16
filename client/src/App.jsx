import { useState } from 'react';
import UploadPage from './components/UploadPage';
import ProcessingPage from './components/ProcessingPage';
import ResultsPage from './components/ResultsPage';
import './App.css';

function App() {
  const [page, setPage] = useState('upload');
  const [jobId, setJobId] = useState(null);
  const [results, setResults] = useState(null);

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

  return (
    <div className="app">
      {page === 'upload' && (
        <UploadPage onComplete={handleUploadComplete} />
      )}
      {page === 'processing' && (
        <ProcessingPage jobId={jobId} onComplete={handleProcessingComplete} />
      )}
      {page === 'results' && (
        <ResultsPage results={results} onReset={handleReset} />
      )}
    </div>
  );
}

export default App;
