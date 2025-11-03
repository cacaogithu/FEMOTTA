import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import UploadPage from './components/UploadPage';
import ProcessingPage from './components/ProcessingPage';
import ResultsPage from './components/ResultsPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import BrandForm from './pages/admin/BrandForm';
import SubaccountDetail from './pages/admin/SubaccountDetail';
import BrandLogin from './pages/BrandLogin';
import UserLogin from './pages/UserLogin';
import ProtectedRoute from './components/ProtectedRoute';
import { brandService } from './services/brandService';
import './App.css';

function MainApp() {
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

function App() {
  return (
    <Routes>
      {/* Main application routes */}
      <Route path="/" element={<MainApp />} />
      
      {/* User login route */}
      <Route path="/login" element={<UserLogin />} />
      
      {/* Brand-specific login routes */}
      <Route path="/:brandSlug/login" element={<BrandLogin />} />
      
      {/* Admin routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/brands/new"
        element={
          <ProtectedRoute>
            <BrandForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/brands/:id/edit"
        element={
          <ProtectedRoute>
            <BrandForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/subaccounts/:id"
        element={
          <ProtectedRoute>
            <SubaccountDetail />
          </ProtectedRoute>
        }
      />
      
      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
