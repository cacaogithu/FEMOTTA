import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import UploadPage from './components/UploadPage';
import ProcessingPage from './components/ProcessingPage';
import ResultsPage from './components/ResultsPage';
import HistoryPanel from './components/HistoryPanel';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import BrandForm from './pages/admin/BrandForm';
import SubaccountDetail from './pages/admin/SubaccountDetail';
import BrandLogin from './pages/BrandLogin';
import UserLogin from './pages/UserLogin';
import UserRegister from './pages/UserRegister';
import ProtectedRoute from './components/ProtectedRoute';
import UserProtectedRoute from './components/UserProtectedRoute';
import LogoutButton from './components/LogoutButton';
import { brandService } from './services/brandService';
import './App.css';

function MainApp() {
  const [page, setPage] = useState('upload');
  const [activeTab, setActiveTab] = useState('editor');
  const [jobId, setJobId] = useState(null);
  const [results, setResults] = useState(null);
  const [brandLoaded, setBrandLoaded] = useState(false);

  useEffect(() => {
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

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'editor') {
      handleReset();
    }
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
      <LogoutButton />
      
      <nav className="main-nav">
        <button 
          className={`nav-tab ${activeTab === 'editor' ? 'active' : ''}`}
          onClick={() => handleTabChange('editor')}
        >
          Editor
        </button>
        <button 
          className={`nav-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => handleTabChange('history')}
        >
          History
        </button>
      </nav>

      {activeTab === 'editor' && (
        <>
          {page === 'upload' && (
            <UploadPage onComplete={handleUploadComplete} />
          )}
          {page === 'processing' && (
            <ProcessingPage jobId={jobId} onComplete={handleProcessingComplete} />
          )}
          {page === 'results' && (
            <ResultsPage results={results} onReset={handleReset} jobId={jobId} />
          )}
        </>
      )}

      {activeTab === 'history' && (
        <HistoryPanel />
      )}
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<UserLogin />} />
      <Route path="/register" element={<UserRegister />} />
      
      {/* Main application routes - Protected */}
      <Route 
        path="/" 
        element={
          <UserProtectedRoute>
            <MainApp />
          </UserProtectedRoute>
        } 
      />
      <Route 
        path="/editor" 
        element={
          <UserProtectedRoute>
            <MainApp />
          </UserProtectedRoute>
        } 
      />
      
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
      
      {/* Catch all - redirect to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
