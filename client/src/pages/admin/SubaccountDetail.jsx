import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './SubaccountDetail.css';

function SubaccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [subaccount, setSubaccount] = useState(null);
  const [users, setUsers] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [settings, setSettings] = useState(null);
  
  const [newUser, setNewUser] = useState({ email: '', username: '', role: 'member', password: '' });
  const [showAddUser, setShowAddUser] = useState(false);

  useEffect(() => {
    loadSubaccount();
    loadUsers();
    loadPrompts();
    loadAnalytics();
    loadSettings();
  }, [id]);

  const loadSubaccount = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/brands/${id}`, {
        headers: { 'X-Admin-Key': token }
      });
      const data = await response.json();
      setSubaccount(data);
    } catch (error) {
      console.error('Error loading subaccount:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/subaccounts/${id}/users`, {
        headers: { 'X-Admin-Key': token }
      });
      const data = await response.json();
      setUsers(data.users || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading users:', error);
      setLoading(false);
    }
  };

  const loadPrompts = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/subaccounts/${id}/prompts`, {
        headers: { 'X-Admin-Key': token }
      });
      const data = await response.json();
      setPrompts(data);
    } catch (error) {
      console.error('Error loading prompts:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/subaccounts/${id}/analytics/usage`, {
        headers: { 'X-Admin-Key': token }
      });
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/subaccounts/${id}/settings`, {
        headers: { 'X-Admin-Key': token }
      });
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/subaccounts/${id}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': token
        },
        body: JSON.stringify(newUser)
      });
      
      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to add user');
        return;
      }
      
      setNewUser({ email: '', username: '', role: 'member', password: '' });
      setShowAddUser(false);
      loadUsers();
      loadSettings();
    } catch (error) {
      console.error('Error adding user:', error);
      alert('Failed to add user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to remove this user?')) return;
    
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/subaccounts/${id}/users/${userId}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Key': token }
      });
      
      if (response.ok) {
        loadUsers();
        loadSettings();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  if (loading) {
    return <div className="subaccount-detail loading">Loading...</div>;
  }

  return (
    <div className="subaccount-detail">
      <div className="subaccount-header">
        <button className="back-button" onClick={() => navigate('/admin')}>
          ← Back to Dashboard
        </button>
        <h1>{subaccount?.displayName || subaccount?.name}</h1>
        <div className="subaccount-meta">
          <span className="badge">{subaccount?.brandType || 'primary'}</span>
          <span className="slug">/{subaccount?.slug}</span>
        </div>
      </div>

      <div className="tabs">
        <button 
          className={activeTab === 'overview' ? 'active' : ''} 
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={activeTab === 'users' ? 'active' : ''} 
          onClick={() => setActiveTab('users')}
        >
          Users ({users.length}/{settings?.seatsPurchased || 0})
        </button>
        <button 
          className={activeTab === 'prompts' ? 'active' : ''} 
          onClick={() => setActiveTab('prompts')}
        >
          Prompts ({prompts.length})
        </button>
        <button 
          className={activeTab === 'workflow' ? 'active' : ''} 
          onClick={() => setActiveTab('workflow')}
        >
          Workflow
        </button>
        <button 
          className={activeTab === 'analytics' ? 'active' : ''} 
          onClick={() => setActiveTab('analytics')}
        >
          Analytics
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <h2>Subaccount Overview</h2>
            <div className="metrics-grid">
              <div className="metric-card">
                <h3>Users</h3>
                <div className="metric-value">{users.length} / {settings?.seatsPurchased || 0}</div>
                <div className="metric-label">Seats Used</div>
              </div>
              <div className="metric-card">
                <h3>Jobs</h3>
                <div className="metric-value">{analytics?.totals?.jobsCompleted || 0}</div>
                <div className="metric-label">Total Completed</div>
              </div>
              <div className="metric-card">
                <h3>Images</h3>
                <div className="metric-value">{analytics?.totals?.imagesProcessed || 0}</div>
                <div className="metric-label">Processed</div>
              </div>
              <div className="metric-card">
                <h3>Prompts</h3>
                <div className="metric-value">{prompts.length}</div>
                <div className="metric-label">Active Templates</div>
              </div>
            </div>

            <div className="limits-section">
              <h3>Usage Limits</h3>
              <div className="limit-item">
                <span>Monthly Job Limit</span>
                <span className="limit-value">{settings?.monthlyJobLimit || 100}</span>
              </div>
              <div className="limit-item">
                <span>Monthly Image Limit</span>
                <span className="limit-value">{settings?.monthlyImageLimit || 1000}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="users-tab">
            <div className="tab-header">
              <h2>User Management</h2>
              <button 
                className="add-user-btn" 
                onClick={() => setShowAddUser(!showAddUser)}
                disabled={users.length >= (settings?.seatsPurchased || 0)}
              >
                + Add User
              </button>
            </div>

            {showAddUser && (
              <form className="add-user-form" onSubmit={handleAddUser}>
                <input
                  type="email"
                  placeholder="Email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                />
                <input
                  type="text"
                  placeholder="Username"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  required
                />
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="viewer">Viewer</option>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
                <input
                  type="password"
                  placeholder="Password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                />
                <button type="submit">Add User</button>
                <button type="button" onClick={() => setShowAddUser(false)}>Cancel</button>
              </form>
            )}

            <table className="users-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td><span className={`role-badge ${user.role}`}>{user.role}</span></td>
                    <td>{user.active ? '✓ Active' : '⨯ Inactive'}</td>
                    <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}</td>
                    <td>
                      <button 
                        className="delete-user-btn" 
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'prompts' && (
          <div className="prompts-tab">
            <div className="tab-header">
              <h2>Prompt Templates</h2>
              <button className="add-prompt-btn">+ New Prompt</button>
            </div>
            <div className="prompts-list">
              {prompts.map((prompt) => (
                <div key={prompt.id} className="prompt-card">
                  <h3>{prompt.name}</h3>
                  <p>{prompt.description}</p>
                  <div className="prompt-meta">
                    <span className="category">{prompt.category || 'General'}</span>
                    <span className="versions">{prompt.versions?.length || 0} versions</span>
                    {prompt.isDefault && <span className="default-badge">Default</span>}
                  </div>
                </div>
              ))}
              {prompts.length === 0 && (
                <div className="empty-state">No prompts yet. Create your first prompt template.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'workflow' && (
          <div className="workflow-tab">
            <h2>Workflow Customization</h2>
            <p className="coming-soon">Visual workflow builder coming soon...</p>
            <div className="workflow-preview">
              <h3>Current Workflow</h3>
              <ol className="workflow-steps">
                <li>Upload Brief & Images</li>
                <li>AI Processing</li>
                <li>Review Results</li>
                <li>Download / Re-edit</li>
              </ol>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="analytics-tab">
            <h2>Usage Analytics</h2>
            <div className="analytics-grid">
              <div className="analytics-card">
                <h3>Jobs</h3>
                <div className="stat-row">
                  <span>Created</span>
                  <span className="stat-value">{analytics?.totals?.jobsCreated || 0}</span>
                </div>
                <div className="stat-row">
                  <span>Completed</span>
                  <span className="stat-value">{analytics?.totals?.jobsCompleted || 0}</span>
                </div>
              </div>
              <div className="analytics-card">
                <h3>Images</h3>
                <div className="stat-row">
                  <span>Processed</span>
                  <span className="stat-value">{analytics?.totals?.imagesProcessed || 0}</span>
                </div>
              </div>
              <div className="analytics-card">
                <h3>Time Saved</h3>
                <div className="stat-row">
                  <span>Total</span>
                  <span className="stat-value">
                    {Math.round((analytics?.totals?.totalTimeSavedSeconds || 0) / 60)} min
                  </span>
                </div>
              </div>
              <div className="analytics-card">
                <h3>Estimated Cost</h3>
                <div className="stat-row">
                  <span>Total</span>
                  <span className="stat-value">
                    ${((analytics?.totals?.totalCostCents || 0) / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SubaccountDetail;
