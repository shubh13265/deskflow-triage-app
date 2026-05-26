import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Filter, 
  Clock, 
  AlertTriangle, 
  ArrowLeft, 
  ArrowRight, 
  Trash2, 
  RefreshCw, 
  Settings,
  X,
  CheckCircle2,
  Mail,
  User,
  AlertCircle
} from 'lucide-react';

const STATUS_COLUMNS = [
  { id: 'open', label: 'Open', color: 'open' },
  { id: 'in_progress', label: 'In Progress', color: 'progress' },
  { id: 'resolved', label: 'Resolved', color: 'resolved' },
  { id: 'closed', label: 'Closed', color: 'closed' }
];

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export default function App() {
  // Configurable API base URL with LocalStorage and environment variable fallback
  const defaultApiBase = import.meta.env.VITE_API_URL || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5000'
      : '/api'
  );
  const [apiBase, setApiBase] = useState(() => {
    const saved = localStorage.getItem('deskflow_api_base');
    return saved || defaultApiBase;
  });
  
  const [showConfig, setShowConfig] = useState(false);
  const [configUrl, setConfigUrl] = useState(apiBase);

  // App States
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({
    statusCounts: { open: 0, in_progress: 0, resolved: 0, closed: 0 },
    priorityCounts: { low: 0, medium: 0, high: 0, urgent: 0 },
    openBreachedCount: 0
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter States
  const [priorityFilter, setPriorityFilter] = useState('');
  const [breachedFilter, setBreachedFilter] = useState(false);
  
  // Create Form State
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [formValues, setFormValues] = useState({
    subject: '',
    description: '',
    customerEmail: '',
    priority: 'low'
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Fetch Tickets
  const fetchTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (priorityFilter) params.append('priority', priorityFilter);
      if (breachedFilter) params.append('breached', 'true');
      
      const res = await fetch(`${apiBase}/tickets?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch tickets: ${res.statusText}`);
      }
      const data = await res.json();
      setTickets(data);
    } catch (err) {
      console.error(err);
      setError('Could not connect to the backend. Please check your API URL in settings.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Stats
  const fetchStats = async () => {
    try {
      const res = await fetch(`${apiBase}/tickets/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Run on mount and when filters/API base changes
  useEffect(() => {
    fetchTickets();
    fetchStats();
  }, [apiBase, priorityFilter, breachedFilter]);

  // Handle Save Config
  const saveConfig = (e) => {
    e.preventDefault();
    let url = configUrl.trim();
    if (url.endsWith('/bfhl') || url.endsWith('/api') || url.endsWith('/tickets')) {
      alert("Invalid input: Please provide the Base URL only (e.g., https://yourname-bfhl.herokuapp.com). Do NOT add /bfhl or other endpoints at the end.");
      return;
    }
    // Remove trailing slashes
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }
    
    localStorage.setItem('deskflow_api_base', url);
    setApiBase(url);
    setShowConfig(false);
  };

  // Reset Config to Default
  const resetConfig = () => {
    localStorage.removeItem('deskflow_api_base');
    setApiBase(defaultApiBase);
    setConfigUrl(defaultApiBase);
    setShowConfig(false);
  };

  // Handle Status Move (Enforcing transition rules optimistically and calling API)
  const moveTicket = async (ticket, direction) => {
    const currentStatusIndex = STATUS_COLUMNS.findIndex(col => col.id === ticket.status);
    const newStatusIndex = currentStatusIndex + direction;
    
    if (newStatusIndex < 0 || newStatusIndex >= STATUS_COLUMNS.length) return;
    
    const newStatus = STATUS_COLUMNS[newStatusIndex].id;
    
    // Save previous state for rollback if call fails
    const originalTickets = [...tickets];
    
    // Optimistic UI Update
    setTickets(prev => prev.map(t => {
      if (t._id === ticket._id) {
        // Compute local updates (set/clear resolvedAt)
        let resolvedAt = t.resolvedAt;
        if (newStatus === 'resolved') {
          resolvedAt = new Date().toISOString();
        } else if (t.status === 'resolved' && newStatus === 'in_progress') {
          resolvedAt = null;
        }
        return {
          ...t,
          status: newStatus,
          resolvedAt
        };
      }
      return t;
    }));

    try {
      const res = await fetch(`${apiBase}/tickets/${ticket._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update ticket status');
      }
      
      // Fetch stats again to update strip
      fetchStats();
    } catch (err) {
      alert(err.message);
      // Rollback on error
      setTickets(originalTickets);
    }
  };

  // Handle Create Ticket
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});
    
    // Client-side validations
    const errors = {};
    if (!formValues.subject.trim()) errors.subject = 'Subject is required';
    if (!formValues.description.trim()) errors.description = 'Description is required';
    if (!formValues.customerEmail.trim()) {
      errors.customerEmail = 'Customer email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formValues.customerEmail)) {
      errors.customerEmail = 'Please provide a valid email address';
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues)
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create ticket');
      }
      
      // Reset form and close
      setFormValues({
        subject: '',
        description: '',
        customerEmail: '',
        priority: 'low'
      });
      setShowCreatePanel(false);
      
      // Refresh board and stats
      fetchTickets();
      fetchStats();
    } catch (err) {
      setFormErrors({ submit: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Ticket
  const handleDeleteTicket = async (id) => {
    if (!window.confirm('Are you sure you want to delete this ticket?')) return;
    
    const originalTickets = [...tickets];
    // Optimistic remove
    setTickets(prev => prev.filter(t => t._id !== id));
    
    try {
      const res = await fetch(`${apiBase}/tickets/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        throw new Error('Failed to delete ticket');
      }
      fetchStats();
    } catch (err) {
      alert(err.message);
      setTickets(originalTickets);
    }
  };

  // Helper to format minutes into human readable text (e.g. 1h 45m or 12m)
  const formatAge = (minutes) => {
    if (minutes < 0 || isNaN(minutes)) return '0m';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header>
        <div className="logo-section">
          <h1>DeskFlow</h1>
          <p>Support Ticket Triage Board</p>
        </div>
        <div className="actions-section">
          <button 
            className="action-btn" 
            onClick={() => setShowConfig(true)}
            title="Configure Backend Connection"
          >
            <Settings size={16} />
            <span>API Settings</span>
          </button>
          
          <button className="btn-primary" onClick={() => setShowCreatePanel(true)}>
            <Plus size={18} />
            <span>Create Ticket</span>
          </button>
        </div>
      </header>

      {/* API Configuration Overlay */}
      {showConfig && (
        <div className="panel-overlay" onClick={() => setShowConfig(false)}>
          <div className="panel" onClick={e => e.stopPropagation()}>
            <div className="panel-header">
              <h2>API Connection Settings</h2>
              <button className="close-btn" onClick={() => setShowConfig(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={saveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Backend URL</label>
                <input 
                  type="text" 
                  className="text-input" 
                  value={configUrl}
                  onChange={e => setConfigUrl(e.target.value)}
                  placeholder="e.g. http://localhost:5000"
                  required
                />
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Provide the root URL of your deployed backend service.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="submit-btn" style={{ flex: 1, margin: 0 }}>
                  Save Configuration
                </button>
                <button 
                  type="button" 
                  onClick={resetConfig} 
                  className="action-btn"
                  style={{ padding: '0 1.25rem', height: '42px', alignSelf: 'flex-end' }}
                >
                  Reset Default
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats Strip */}
      <section className="stats-strip">
        {STATUS_COLUMNS.map(col => (
          <div className="stat-card" key={col.id}>
            <span className="stat-title">{col.label} Tickets</span>
            <span className="stat-value">{stats.statusCounts[col.id] || 0}</span>
          </div>
        ))}
        <div className="stat-card breached">
          <span className="stat-title">Open SLA Breached</span>
          <span className="stat-value">
            <AlertTriangle size={24} style={{ marginRight: '4px' }} />
            {stats.openBreachedCount || 0}
          </span>
        </div>
      </section>

      {/* Filters */}
      <section className="filters-bar">
        <div className="filter-group">
          <Filter size={16} style={{ color: 'var(--text-muted)' }} />
          <span className="filter-label">Priority:</span>
          <select 
            className="select-input" 
            value={priorityFilter} 
            onChange={e => setPriorityFilter(e.target.value)}
          >
            <option value="">All Priorities</option>
            {PRIORITIES.map(p => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="toggle-container">
            <input 
              type="checkbox" 
              checked={breachedFilter} 
              onChange={e => setBreachedFilter(e.target.checked)}
              style={{ display: 'none' }}
            />
            <div className="toggle-switch"></div>
            <span>Show SLA Breached Only</span>
          </label>
          
          <button 
            className="action-btn"
            onClick={() => { fetchTickets(); fetchStats(); }}
            title="Refresh board data"
            style={{ marginLeft: '1rem' }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </section>

      {/* Error Alert */}
      {error && (
        <div className="global-error" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Board View */}
      <main className="board">
        {STATUS_COLUMNS.map(col => {
          const columnTickets = tickets.filter(t => t.status === col.id);
          
          return (
            <div className="column" key={col.id}>
              <div className="column-header">
                <div className="column-title">
                  <div className={`column-dot ${col.color}`}></div>
                  <span>{col.label}</span>
                </div>
                <span className="column-count">{columnTickets.length}</span>
              </div>
              
              <div className="column-body">
                {loading ? (
                  <div className="loading-container">
                    <RefreshCw size={24} className="animate-spin" />
                  </div>
                ) : columnTickets.length === 0 ? (
                  <div className="empty-state">No tickets</div>
                ) : (
                  columnTickets.map(ticket => {
                    const currentIdx = STATUS_COLUMNS.findIndex(c => c.id === col.id);
                    const canMoveLeft = currentIdx > 0;
                    const canMoveRight = currentIdx < STATUS_COLUMNS.length - 1;
                    
                    return (
                      <div className="ticket-card" key={ticket._id}>
                        <div className="ticket-header">
                          <span className="ticket-subject">{ticket.subject}</span>
                          <span className={`badge ${ticket.priority}`}>
                            {ticket.priority}
                          </span>
                        </div>
                        
                        <p className="ticket-desc">{ticket.description}</p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Mail size={12} />
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {ticket.customerEmail}
                            </span>
                          </div>
                        </div>

                        <div className="ticket-meta">
                          <div className="ticket-time">
                            <Clock size={12} />
                            <span>{formatAge(ticket.ageMinutes)}</span>
                          </div>
                          
                          {ticket.slaBreached && (
                           <span className="breach-alert">
                              <AlertTriangle size={12} />
                              <span>SLA Breached</span>
                            </span>
                          )}
                        </div>

                        {/* Navigation controls - only showing adjacent operations */}
                        <div className="ticket-actions">
                          <button 
                            className="action-btn"
                            disabled={!canMoveLeft}
                            onClick={() => moveTicket(ticket, -1)}
                            title={canMoveLeft ? `Move to ${STATUS_COLUMNS[currentIdx - 1].label}` : ''}
                          >
                            <ArrowLeft size={12} />
                            <span>Back</span>
                          </button>
                          
                          <button 
                            className="action-btn delete-btn"
                            onClick={() => handleDeleteTicket(ticket._id)}
                            title="Delete Ticket"
                          >
                            <Trash2 size={12} />
                          </button>
                          
                          <button 
                            className="action-btn"
                            disabled={!canMoveRight}
                            onClick={() => moveTicket(ticket, 1)}
                            title={canMoveRight ? `Move to ${STATUS_COLUMNS[currentIdx + 1].label}` : ''}
                          >
                            <span>Next</span>
                            <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </main>

      {/* Create Ticket Sliding Panel */}
      {showCreatePanel && (
        <div className="panel-overlay" onClick={() => setShowCreatePanel(false)}>
          <div className="panel" onClick={e => e.stopPropagation()}>
            <div className="panel-header">
              <h2>Submit Support Ticket</h2>
              <button className="close-btn" onClick={() => setShowCreatePanel(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', paddingRight: '4px' }}>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <input 
                  type="text" 
                  className="text-input"
                  value={formValues.subject}
                  onChange={e => setFormValues(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="e.g. Cannot log in to portal"
                />
                {formErrors.subject && <span className="error-text">{formErrors.subject}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  className="textarea-input"
                  value={formValues.description}
                  onChange={e => setFormValues(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Provide details about the issue..."
                />
                {formErrors.description && <span className="error-text">{formErrors.description}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Customer Email</label>
                <input 
                  type="email" 
                  className="text-input"
                  value={formValues.customerEmail}
                  onChange={e => setFormValues(prev => ({ ...prev, customerEmail: e.target.value }))}
                  placeholder="customer@company.com"
                />
                {formErrors.customerEmail && <span className="error-text">{formErrors.customerEmail}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Priority</label>
                <select 
                  className="select-input"
                  value={formValues.priority}
                  onChange={e => setFormValues(prev => ({ ...prev, priority: e.target.value }))}
                >
                  <option value="low">Low (72 hours target)</option>
                  <option value="medium">Medium (24 hours target)</option>
                  <option value="high">High (4 hours target)</option>
                  <option value="urgent">Urgent (1 hour target)</option>
                </select>
              </div>

              {formErrors.submit && (
                <div className="global-error" style={{ fontSize: '0.85rem' }}>
                  {formErrors.submit}
                </div>
              )}

              <button type="submit" className="submit-btn" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Create Ticket'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}