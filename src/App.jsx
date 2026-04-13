import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { History, X, Settings, Shield, Plus, Edit, Trash2, Clock, Minus } from 'lucide-react';
import './index.css';

// CONFIG: Replace this with your deployed Apps Script URL
const API_URL = 'https://script.google.com/macros/s/AKfycbwCpjAA0tvsoTn8yW5QAG3vjiVIw-tTZg1ra9JHvyn_ThJqnYuJwo60I5iMO3ybxFZgUg/exec';

// Safely format dates to prevent app crashes on invalid data
const safeDateFormat = (dateString, formatStr) => {
  if (!dateString) return 'No Date';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return format(date, formatStr);
};

// Robustly get a value from an object using multiple potential key variations
const getVal = (obj, ...keys) => {
  const normalizedKeys = keys.map(k => k.toLowerCase().replace(/[\s_-]/g, ''));
  for (const key in obj) {
    const kNormalized = key.toLowerCase().replace(/[\s_-]/g, '');
    if (normalizedKeys.includes(kNormalized)) return obj[key];
  }
  return undefined;
};

// Calculate project totals from entries
const calculateProjectTotals = (entries, projects) => {
  const projectTime = {};
  const sortedEntries = [...entries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const userLastIn = {};

  sortedEntries.forEach(e => {
    const uId = getVal(e, 'userid', 'userId', 'user id', 'uid');
    if (e.type === 'IN') {
      userLastIn[uId] = { time: new Date(e.timestamp), project: e.project || 'No Project' };
    } else if (e.type === 'OUT' && userLastIn[uId]) {
      const duration = (new Date(e.timestamp) - userLastIn[uId].time) / (1000 * 60 * 60);
      const projectName = e.project || userLastIn[uId].project || 'No Project';
      projectTime[projectName] = (projectTime[projectName] || 0) + duration;
      delete userLastIn[uId];
    }
  });

  // Include all active projects even if 0 hours
  projects.forEach(p => {
    if (String(p.archived).toUpperCase() !== 'TRUE' && (p.status || '').toLowerCase() === 'active') {
      if (!projectTime[p.name]) projectTime[p.name] = 0;
    }
  });

  // Handle Split Entries (assuming they are already in projectTime if they were standard)
  // But actually, the entries logic above only handles simple 'OUT' project names.
  // Let's refine the entries processing to handle split data.
  const refinedProjectTime = {};

  // Re-process entries for real split support
  const userLastInRefined = {};
  sortedEntries.forEach(e => {
    const uId = getVal(e, 'userid', 'userId', 'user id', 'uid');
    if (e.type === 'IN') {
      userLastInRefined[uId] = { time: new Date(e.timestamp), project: e.project };
    } else if (e.type === 'OUT' && userLastInRefined[uId]) {
      const duration = (new Date(e.timestamp) - userLastInRefined[uId].time) / (1000 * 60 * 60);
      const projectField = e.project || userLastInRefined[uId].project || 'No Project';

      if (projectField.startsWith('SPLIT:')) {
        try {
          const splits = JSON.parse(projectField.substring(6));
          Object.entries(splits).forEach(([proj, hours]) => {
            refinedProjectTime[proj] = (refinedProjectTime[proj] || 0) + Number(hours);
          });
        } catch (err) {
          console.error('Error parsing split project data:', err);
          refinedProjectTime[projectField] = (refinedProjectTime[projectField] || 0) + duration;
        }
      } else {
        refinedProjectTime[projectField] = (refinedProjectTime[projectField] || 0) + duration;
      }
      delete userLastInRefined[uId];
    }
  });

  const activeProjectNames = projects
    .filter(p => String(p.archived).toUpperCase() !== 'TRUE' && (p.status || '').toLowerCase() === 'active')
    .map(p => p.name);

  // Initialize all active projects with 0 hours if not present
  activeProjectNames.forEach(name => {
    if (!refinedProjectTime[name]) refinedProjectTime[name] = 0;
  });

  return Object.entries(refinedProjectTime)
    .filter(([name]) => activeProjectNames.includes(name))
    .sort((a, b) => b[1] - a[1]); // Sort by hours descending
};

const Leaderboard = ({ entries, projects }) => {
  const totals = calculateProjectTotals(entries, projects);

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header-row">
        <div className="leaderboard-title">Active Projects</div>
      </div>
      <div className="leaderboard-table-wrapper">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Project</th>
              <th style={{ textAlign: 'right' }}>Total Hours</th>
            </tr>
          </thead>
          <tbody>
            {totals.map(([name, hours], index) => (
              <tr key={name}>
                <td>
                  <div className="project-name-cell">
                    <div className="project-rank">{index + 1}</div>
                    {name}
                  </div>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                  {hours.toFixed(2)}h
                </td>
              </tr>
            ))}
            {totals.length === 0 && (
              <tr>
                <td colSpan="2" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  No active project data yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};


const AdminPanel = ({ data, adminTab, setAdminTab, setShowAdmin, onAdd, onDelete, onEdit }) => (
  <div className="admin-container">
    <div className="admin-header">
      <div className="flex items-center gap-2">
        <Shield className="text-primary" />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Admin Dashboard</h2>
      </div>
      <button className="btn-punch" style={{ width: 'auto', padding: '0.5rem 1rem' }} onClick={() => setShowAdmin(false)}>
        Exit Admin
      </button>
    </div>

    <div className="admin-tabs">
      {['users', 'entries', 'projects-report'].map(tab => (
        <div
          key={tab}
          className={`admin-tab ${adminTab === tab ? 'active' : ''}`}
          onClick={() => setAdminTab(tab)}
        >
          {tab === 'projects-report' ? 'Projects Report' : tab.charAt(0).toUpperCase() + tab.slice(1)}
        </div>
      ))}
    </div>

    <div className="admin-table-container">
      {adminTab === 'users' && (
        <table className="admin-table">
          <thead>
            <tr><th>Name</th><th>PIN</th><th>Role</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {data.users.map(u => (
              <tr key={u.id}>
                <td style={{ opacity: String(u.archived).toUpperCase() === 'TRUE' ? 0.5 : 1 }}>
                  {u.name}
                  {String(u.archived).toUpperCase() === 'TRUE' && ' (Deleted)'}
                </td>
                <td>****</td><td>{u.role}</td>
                <td>
                  <div className="flex gap-2">
                    <button className="admin-btn admin-btn-primary" onClick={() => onEdit('user', u)}><Edit size={14} /></button>
                    {String(u.archived).toUpperCase() !== 'TRUE' && (
                      <button className="admin-btn admin-btn-danger" onClick={() => onDelete('user', u.id)}><Trash2 size={14} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {adminTab === 'projects-report' && (
        <table className="admin-table">
          <thead>
            <tr><th>Project Name</th><th>Total Time</th></tr>
          </thead>
          <tbody>
            {calculateProjectTotals(data.entries, data.projects).map(([name, time]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{time.toFixed(2)} hours</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {adminTab === 'entries' && (
        <table className="admin-table">
          <thead>
            <tr><th>User</th><th>Type</th><th>Time</th><th>Project</th><th>Note</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {data.entries.slice().reverse().map(e => (
              <tr key={e.id}>
                <td>{data.users.find(u => u.id == getVal(e, 'userid', 'userId', 'user id', 'uid'))?.name}</td>
                <td style={{ color: e.type === 'IN' ? 'var(--status-in)' : 'var(--status-out)' }}>{e.type}</td>
                <td>{safeDateFormat(e.timestamp, 'MMM d, HH:mm')}</td>
                <td>
                  {e.project?.startsWith('SPLIT:') ? (
                    <div className="split-info">
                      <span className="text-primary font-bold">Split Project</span>
                      <div className="split-entry-text">
                        {Object.entries(JSON.parse(e.project.substring(6)))
                          .map(([p, h]) => `${p} (${Number(h).toFixed(1)}h)`)
                          .join(', ')}
                      </div>
                    </div>
                  ) : (
                    e.project
                  )}
                </td>
                <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{e.note}</td>
                <td>
                  <button className="admin-btn admin-btn-primary" onClick={() => onEdit('entry', e)}><Edit size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>

    {adminTab === 'users' && (
      <button
        className="admin-btn admin-btn-primary mt-4"
        style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', width: '100%' }}
        onClick={() => onAdd('user')}
      >
        <Plus size={18} /> Add New User
      </button>
    )}
  </div>
);

const HomeScreen = ({ currentTime, data, onLogin, clockedInUsers = [] }) => (
  <div className="flex flex-col h-full">
    <div className="home-header home-header-main">
      <div className="header-left">
        <div className="clock">{format(currentTime, 'h:mm a')}</div>
        <div className="date">{format(currentTime, 'EEEE, MMMM do')}</div>
      </div>
      <div className="flex items-center gap-4">
        <div className="login-btn-container">
          <button className="btn-proceed" onClick={onLogin}>
            <Clock size={24} />
          </button>
          {clockedInUsers.length > 0 && (
            <div className="logged-in-indicators indicators-absolute">
              {clockedInUsers.slice(0, 6).map(user => {
                const initials = user.name ? user.name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase() : '?';
                return (
                  <div key={user.id} className="indicator-avatar" title={user.name}>
                    {initials.substring(0, 2)}
                  </div>
                );
              })}
              {clockedInUsers.length > 6 && (
                <div className="indicator-more">
                  +{clockedInUsers.length - 6}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    <Leaderboard entries={data.entries} projects={data.projects} />
  </div>
);


const ClockOutPopup = ({ duration, projects, onConfirm, onClose }) => {
  const [selected, setSelected] = useState([]);
  const [shares, setShares] = useState({}); // {projectIndex: percentage}
  const colors = ['#6366f1', '#10b981', '#f59e0b'];

  const toggleProject = (projectName) => {
    setSelected(prev => {
      let next;
      if (prev.includes(projectName)) {
        next = prev.filter(p => p !== projectName);
      } else if (prev.length < 3) {
        next = [...prev, projectName];
      } else {
        return prev;
      }

      const newShares = {};
      const shareVal = next.length > 0 ? (100 / next.length) : 0;
      next.forEach((p, i) => { newShares[i] = shareVal; });
      setShares(newShares);
      return next;
    });
  };

  const updateShare = (index, newValue) => {
    setShares(prev => {
      const next = { ...prev };
      const otherIndices = Object.keys(prev).map(Number).filter(i => i !== index);
      if (otherIndices.length === 0) return { ...prev, [index]: 100 };

      const newVal = Math.min(100, Math.max(0, Number(newValue) || 0));
      const actualDelta = newVal - (next[index] || 0);
      next[index] = newVal;

      const shareToTake = actualDelta / otherIndices.length;
      otherIndices.forEach(i => {
        next[i] = Math.max(0, (next[i] || 0) - shareToTake);
      });

      const total = Object.values(next).reduce((a, b) => a + b, 0);
      if (total !== 100 && total > 0) {
        const diff = 100 - total;
        next[otherIndices[0]] = Math.max(0, next[otherIndices[0]] + diff);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    if (selected.length === 0) return alert('Select at least one project');
    const splitData = {};
    selected.forEach((p, i) => {
      const hours = (shares[i] / 100) * duration;
      splitData[p] = hours.toFixed(4);
    });
    onConfirm(`SPLIT:${JSON.stringify(splitData)}`);
  };

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-title">Clock Out & Allocate Time</div>
        <div className="allocation-container">
          <div className="allocation-summary">
            <span style={{ fontWeight: 600 }}>Total Time:</span>
            <span className="total-time-badge">{duration.toFixed(2)} hours</span>
          </div>
          <div className="visual-allocation-bar">
            {selected.map((p, i) => (
              <div key={p} className="allocation-segment" style={{ width: `${shares[i]}%`, background: colors[i] }}>
                {shares[i] > 15 ? `${shares[i].toFixed(0)}%` : ''}
              </div>
            ))}
          </div>
          <div className="project-controls">
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Select up to 3 projects:</div>
            <div className="grid" style={{ gridTemplateColumns: '1fr', maxHeight: '200px', margin: 0 }}>
              {projects.filter(p => String(p.archived).toUpperCase() !== 'TRUE' && (p.status || '').toLowerCase() === 'active').map(p => {
                const isSelected = selected.includes(p.name);
                const selIdx = selected.indexOf(p.name);
                return (
                  <div key={p.id} className="project-control-item" onClick={() => toggleProject(p.name)} style={{ borderColor: isSelected ? colors[selIdx] : 'var(--glass-border)', background: isSelected ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)' }}>
                    <div className="project-color-indicator" style={{ background: isSelected ? colors[selIdx] : 'rgba(255,255,255,0.1)' }} />
                    <div className="project-info">
                      <span className="project-name-text">{p.name}</span>
                      {isSelected && <span className="project-share-text">{((shares[selIdx] / 100) * duration).toFixed(2)}h total</span>}
                    </div>
                    {isSelected && (
                      <div className="adjustment-controls" onClick={e => e.stopPropagation()}>
                        <button
                          className="adjust-btn"
                          onClick={() => updateShare(selIdx, (shares[selIdx] || 0) - 5)}
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="number"
                          className="percent-input"
                          value={Math.round(shares[selIdx])}
                          onChange={(e) => updateShare(selIdx, e.target.value)}
                          min="0"
                          max="100"
                        />
                        <button
                          className="adjust-btn"
                          onClick={() => updateShare(selIdx, (shares[selIdx] || 0) + 5)}
                        >
                          <Plus size={14} />
                        </button>
                        <span className="percent-symbol">%</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <button className="btn-proceed" style={{ width: '100%', marginTop: '1rem' }} onClick={handleConfirm} disabled={selected.length === 0}>Confirm Clock Out</button>
          <button className="btn-back" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};


const App = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [data, setData] = useState({ users: [], projects: [], entries: [] });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('home'); // 'home', 'login'
  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState('users'); // users, projects, entries
  const [showLogs, setShowLogs] = useState(false);
  const [modalType, setModalType] = useState(null); // 'pin', 'project'
  const [modalMode, setModalMode] = useState('user'); // 'user', 'admin'
  const [adminModal, setAdminModal] = useState(null); // { action: 'add'|'edit', type: 'user'|'project'|'entry', item?: any }
  const [formData, setFormData] = useState({});
  const [clockOutDuration, setClockOutDuration] = useState(0);


  const fetchData = useCallback(async () => {
    if (!API_URL || API_URL.includes('YOUR_SCRIPT_ID')) {
      console.warn('API URL not set. Using mock data.');
      setData({
        users: [
          { id: '1', name: 'Alice Admin', pin: '1234', role: 'Admin' },
          { id: '2', name: 'Bob Employee', pin: '0000', role: 'User' }
        ],
        projects: [
          { id: '1', name: 'Project A', status: 'active' },
          { id: '2', name: 'Project B', status: 'active' }
        ],
        entries: []
      });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}?action=getData&cache=${Date.now()}`);
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      setData(result);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [fetchData]);

  // Sync duration and splits when admin edits timestamp
  useEffect(() => {
    if (adminModal?.type === 'entry' && adminModal?.action === 'edit' && adminModal?.item?.type === 'OUT') {
      const inEntry = data.entries.find(e => e.type === 'IN' && (e.sessionid === adminModal.item.sessionid || e.id === adminModal.item.sessionid));
      if (inEntry) {
        const dateOut = new Date(formData.timestamp);
        const dateIn = new Date(inEntry.timestamp);
        if (!isNaN(dateOut.getTime()) && !isNaN(dateIn.getTime())) {
          const newDuration = (dateOut - dateIn) / (1000 * 60 * 60);
          if (newDuration !== formData.duration && newDuration >= 0) {
            setFormData(prev => {
              let newProject = prev.project;
              if (prev.project?.startsWith('SPLIT:')) {
                try {
                  const splitData = JSON.parse(prev.project.substring(6));
                  const newSplitData = {};
                  Object.entries(splitData).forEach(([p, h]) => {
                    const share = Number(h) / (prev.duration || 1);
                    newSplitData[p] = (share * newDuration).toFixed(4);
                  });
                  newProject = `SPLIT:${JSON.stringify(newSplitData)}`;
                } catch (e) { console.error('Recalculate error:', e); }
              }
              return { ...prev, duration: newDuration, project: newProject };
            });
          }
        }
      }
    }
  }, [formData.timestamp, adminModal, data.entries, formData.duration]);

  const getUserStatus = useCallback((userId) => {
    const userEntries = data.entries
      .filter(e => {
        const uId = getVal(e, 'userid', 'userId', 'user id', 'uid');
        return uId == userId && e.timestamp; // Only consider entries with timestamps
      })
      .sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
        const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
        return timeB - timeA;
      });

    const lastEntry = userEntries[0];
    return {
      clockedIn: lastEntry ? lastEntry.type === 'IN' : false,
      lastPunch: lastEntry ? lastEntry.timestamp : null,
      lastInId: (lastEntry && lastEntry.type === 'IN') ? (lastEntry.sessionid || lastEntry.id) : null
    };
  }, [data.entries]);

  const resetState = useCallback(() => {
    setSelectedUser(null);
    setPin('');
    setModalType(null);
    setModalMode('user');
    setView('home');
  }, []);

  const handlePunch = useCallback(async (project = '', userOverride = null) => {
    const user = userOverride || selectedUser;
    if (!user) return;

    const userStatus = getUserStatus(user.id);
    const type = userStatus.clockedIn ? 'OUT' : 'IN';

    try {
      setLoading(true);
      console.log('Sending punch:', { action: 'punch', userId: user.id, project, type });
      const resp = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'punch',
          userId: user.id,
          project,
          type,
          sessionId: userStatus.lastInId
        })
      });
      const resJson = await resp.json();
      console.log('Punch response:', resJson);
      if (resJson.error) throw new Error(resJson.error);

      // Brief delay (1.5s) to ensure Google Sheets has processed the row before we fetch
      setTimeout(async () => {
        await fetchData();
        resetState();
      }, 1500);
    } catch (error) {
      console.error('Punch error details:', error);
      alert('Punch failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedUser, fetchData, getUserStatus, resetState]);

  const handleAdd = (type) => {
    setAdminModal({ action: 'add', type });
    if (type === 'user') setFormData({ name: '', pin: '', role: 'User' });
    else if (type === 'project') setFormData({ name: '' });
  };

  const handleDelete = async (type, id) => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
    setLoading(true);
    try {
      const action = type === 'user' ? 'deleteuser' : 'deleteproject';
      const res = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action, id })
      });
      const resJson = await res.json();
      if (resJson.error) throw new Error(resJson.error);
      await fetchData();
    } catch (e) { alert(e.message); }
    setLoading(false);
  };

  const handleEdit = (type, item) => {
    setAdminModal({ action: 'edit', type, item });
    if (type === 'user') setFormData({ name: item.name, pin: item.pin, role: item.role });
    else if (type === 'entry') {
      let duration = 0;
      if (item.type === 'OUT') {
        const inEntry = data.entries.find(e => e.type === 'IN' && (e.sessionid === item.sessionid || e.id === item.sessionid));
        if (inEntry) {
          duration = (new Date(item.timestamp) - new Date(inEntry.timestamp)) / (1000 * 60 * 60);
        }
      }
      setFormData({
        timestamp: item.timestamp,
        reason: '',
        project: item.project || '',
        duration: duration > 0 ? duration : 0
      });
    }
  };

  const handleAdminModalSubmit = async (e) => {
    e.preventDefault();
    const { action, type, item } = adminModal;
    let payload = null;

    if (action === 'add' && type === 'user') {
      const { name, pin, role } = formData;
      if (!name || !pin || !role) return alert('All fields are required');
      payload = { action: 'adduser', id: Date.now().toString(), name, pin, role };
    } else if (action === 'add' && type === 'project') {
      const { name } = formData;
      if (!name) return alert('Name is required');
      payload = { action: 'addproject', name };
    } else if (action === 'edit' && type === 'user') {
      const { name, pin, role } = formData;
      if (!name || !pin || !role) return alert('All fields are required');
      payload = { action: 'updateuser', id: item.id, name, pin, role };
    } else if (action === 'edit' && type === 'entry') {
      const { timestamp, reason, project } = formData;
      if (!timestamp || !reason) return alert('All fields are required');

      let splits = '';
      if (project && project.startsWith('SPLIT:')) {
        try {
          const splitObj = JSON.parse(project.substring(6));
          const totalHours = Object.values(splitObj).reduce((sum, h) => sum + Number(h), 0);
          splits = Object.entries(splitObj)
            .map(([p, h]) => {
              const pct = totalHours > 0 ? (Number(h) / totalHours) * 100 : 0;
              return `${p} (${pct.toFixed(0)}%)`;
            })
            .join(', ');
        } catch (e) {
          console.error('Error creating split string:', e);
        }
      }

      payload = {
        action: 'editentry',
        entryId: item.id,
        oldTimestamp: item.timestamp,
        newTimestamp: timestamp,
        adminId: 'SYSTEM',
        reason,
        project,
        splits
      };
    }

    setLoading(true);
    setAdminModal(null);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const resJson = await res.json();
      if (resJson.error) throw new Error(resJson.error);
      await fetchData();
    } catch (e) {
      alert(e.message);
    }
    setLoading(false);
  };

  const renderAdminModal = () => {
    if (!adminModal) return null;
    const { action, type } = adminModal;
    const title = `${action === 'add' ? 'Add' : 'Edit'} ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    const inputStyle = { width: '100%', padding: '0.75rem', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none', marginBottom: '1rem' };
    const labelStyle = { display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--text-muted)' };

    return (
      <div className="modal-overlay animate-fade-in" onClick={() => setAdminModal(null)}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 className="modal-title" style={{ margin: 0 }}>{title}</h3>
            <X onClick={() => setAdminModal(null)} className="cursor-pointer" />
          </div>
          <form onSubmit={handleAdminModalSubmit}>
            {type === 'user' && (
              <>
                <div>
                  <label style={labelStyle}>Name</label>
                  <input type="text" style={inputStyle} value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required autoFocus />
                </div>
                <div>
                  <label style={labelStyle}>4-Digit PIN</label>
                  <input type="text" maxLength={4} pattern="[0-9]{4}" style={inputStyle} value={formData.pin || ''} onChange={e => setFormData({ ...formData, pin: e.target.value })} required title="4-digit PIN" />
                </div>
                <div>
                  <label style={labelStyle}>Role</label>
                  <select style={{ ...inputStyle, background: '#1e1b4b' }} value={formData.role || 'User'} onChange={e => setFormData({ ...formData, role: e.target.value })} required>
                    <option value="User">User</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </>
            )}

            {type === 'project' && (
              <div>
                <label style={labelStyle}>Project Name</label>
                <input type="text" style={inputStyle} value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required autoFocus />
              </div>
            )}

            {type === 'entry' && (
              <>
                <div>
                  <label style={labelStyle}>Timestamp (ISO Format)</label>
                  <input type="text" style={inputStyle} value={formData.timestamp || ''} onChange={e => setFormData({ ...formData, timestamp: e.target.value })} required autoFocus />
                </div>
                <div>
                  <label style={labelStyle}>Reason for correction</label>
                  <input type="text" style={inputStyle} value={formData.reason || ''} onChange={e => setFormData({ ...formData, reason: e.target.value })} required />
                </div>

                {adminModal.item.type === 'OUT' && (
                  <div className="admin-split-editor">
                    <label style={labelStyle}>Project Allocation ({formData.duration?.toFixed(2)}h total)</label>
                    <div className="project-controls" style={{ marginTop: '0.5rem', maxHeight: '200px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                      {(() => {
                        let selected = [];
                        let shares = {};
                        try {
                          if (formData.project?.startsWith('SPLIT:')) {
                            const splitData = JSON.parse(formData.project.substring(6));
                            selected = Object.keys(splitData);
                            Object.entries(splitData).forEach(([proj, hours]) => {
                              shares[proj] = (Number(hours) / (formData.duration || 1)) * 100;
                            });
                          } else if (formData.project) {
                            selected = [formData.project];
                            shares[formData.project] = 100;
                          }
                        } catch (e) { console.error(e); }

                        const updateEntryProject = (projName) => {
                          let nextSelected;
                          if (selected.includes(projName)) {
                            nextSelected = selected.filter(pn => pn !== projName);
                          } else if (selected.length < 3) {
                            nextSelected = [...selected, projName];
                          } else {
                            return;
                          }

                          if (nextSelected.length === 0) {
                            setFormData({ ...formData, project: '' });
                          } else if (nextSelected.length === 1) {
                            setFormData({ ...formData, project: nextSelected[0] });
                          } else {
                            const newSplitData = {};
                            const share = 100 / nextSelected.length;
                            nextSelected.forEach(pn => {
                              newSplitData[pn] = ((share / 100) * (formData.duration || 0)).toFixed(4);
                            });
                            setFormData({ ...formData, project: `SPLIT:${JSON.stringify(newSplitData)}` });
                          }
                        };

                        const updateEntryShare = (projName, newPct) => {
                          if (selected.length < 2) return;
                          const pct = Math.min(100, Math.max(0, Number(newPct) || 0));
                          const otherProjects = selected.filter(pn => pn !== projName);
                          const oldPct = shares[projName] || 0;
                          const delta = pct - oldPct;
                          const shareToTake = delta / otherProjects.length;

                          const newShares = { ...shares, [projName]: pct };
                          otherProjects.forEach(pn => {
                            newShares[pn] = Math.max(0, (newShares[pn] || 0) - shareToTake);
                          });

                          const total = Object.values(newShares).reduce((a, b) => a + b, 0);
                          if (total !== 100 && total > 0) {
                            const diff = 100 - total;
                            newShares[otherProjects[0]] = Math.max(0, (newShares[otherProjects[0]] || 0) + diff);
                          }

                          const newSplitData = {};
                          selected.forEach(pn => {
                            newSplitData[pn] = ((newShares[pn] / 100) * (formData.duration || 0)).toFixed(4);
                          });
                          setFormData({ ...formData, project: `SPLIT:${JSON.stringify(newSplitData)}` });
                        };

                        return data.projects.filter(p => String(p.archived).toUpperCase() !== 'TRUE').map(p => {
                          const isSelected = selected.includes(p.name);
                          return (
                            <div key={p.id} className="project-control-item" onClick={() => updateEntryProject(p.name)} style={{ padding: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer', borderColor: isSelected ? 'var(--primary)' : 'var(--glass-border)', background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent' }}>
                              <div className="flex items-center justify-between w-full">
                                <span style={{ fontSize: '0.85rem' }}>{p.name}</span>
                                {isSelected && selected.length > 1 && (
                                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    <input
                                      type="number"
                                      className="percent-input"
                                      style={{ width: '50px', padding: '0.2rem', fontSize: '0.75rem' }}
                                      value={Math.round(shares[p.name] || 0)}
                                      onChange={e => updateEntryShare(p.name, e.target.value)}
                                    />
                                    <span style={{ fontSize: '0.75rem' }}>%</span>
                                  </div>
                                )}
                                {isSelected && selected.length === 1 && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>100%</span>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
                {adminModal.item.type === 'IN' && (
                  <div>
                    <label style={labelStyle}>Project</label>
                    <select
                      style={{ ...inputStyle, background: '#1e1b4b' }}
                      value={formData.project || ''}
                      onChange={e => setFormData({ ...formData, project: e.target.value })}
                    >
                      <option value="">No Project</option>
                      {data.projects.filter(p => String(p.archived).toUpperCase() !== 'TRUE').map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" className="admin-btn" style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }} onClick={() => setAdminModal(null)}>Cancel</button>
              <button type="submit" className="admin-btn admin-btn-primary">{action === 'add' ? 'Add' : 'Save Changes'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const handlePinSubmit = useCallback(() => {
    const enteredPin = pin.toString().trim();
    const currentUser = selectedUser; // Capture currently selected user
    setPin(''); // Clear PIN immediately

    if (modalMode === 'admin') {
      const admin = data.users.find(u => {
        const roleStr = (u.role || '').toString().toLowerCase();
        const pinStr = (u.pin || '').toString().trim();
        return roleStr === 'admin' && pinStr === enteredPin;
      });

      if (admin) {
        setShowAdmin(true);
        resetState();
      } else {
        alert('Unauthorized Admin PIN');
      }
      return;
    }

    // User Login
    if (currentUser && enteredPin === (currentUser.pin || '').toString().trim()) {
      const status = getUserStatus(currentUser.id);
      if (status.clockedIn) {
        // Calculate duration since last IN
        const lastIn = new Date(status.lastPunch);
        const duration = (new Date() - lastIn) / (1000 * 60 * 60);
        setClockOutDuration(duration > 0 ? duration : 0);
        setModalType('project'); // Select project on Clock Out
      } else {
        handlePunch('', currentUser); // Clock In immediately, pass currentUser directly
      }
    } else {
      alert('Incorrect PIN');
    }
  }, [pin, modalMode, data.users, selectedUser, handlePunch, getUserStatus, resetState]);

  const handleAdminAuth = () => {
    setModalMode('admin');
    setModalType('pin');
  };


  useEffect(() => {
    if (pin.length === 4) {
      handlePinSubmit();
    }
  }, [pin, handlePinSubmit]);



  const renderPinPad = () => (
    <div className="modal-overlay animate-fade-in" onClick={resetState}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          {modalMode === 'admin' ? 'Enter Admin PIN' : `Enter PIN for ${selectedUser?.name}`}
        </div>
        <div className="pin-display">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`pin-dot ${pin.length >= i ? 'active' : ''}`} />
          ))}
        </div>
        <div className="pin-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button key={num} className="pin-btn" onClick={() => pin.length < 4 && setPin(pin + num)}>
              {num}
            </button>
          ))}
          <div />
          <button className="pin-btn" onClick={() => pin.length < 4 && setPin(pin + '0')}>0</button>
          <div />
        </div>
      </div>
    </div>
  );

  const renderProjectSelector = () => (
    <ClockOutPopup
      duration={clockOutDuration}
      projects={data.projects}
      onConfirm={(p) => handlePunch(p)}
      onClose={resetState}
    />
  );

  if (loading && data.users.length === 0) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
        <div className="loading-text">Loading App Data...</div>
      </div>
    );
  }

  const clockedInUsers = data.users.filter(u =>
    String(u.archived).toUpperCase() !== 'TRUE' && getUserStatus(u.id).clockedIn
  );

  return (
    <div className="app-container animate-fade-in">
      {/* Loading Overlay for subsequent actions */}
      {loading && data.users.length > 0 && (
        <div className="loading-overlay animate-fade-in">
          <div className="spinner"></div>
          <div className="loading-text">Processing...</div>
        </div>
      )}

      {showAdmin && (
        <AdminPanel
          data={data}
          adminTab={adminTab}
          setAdminTab={setAdminTab}
          setShowAdmin={setShowAdmin}
          onAdd={handleAdd}
          onDelete={handleDelete}
          onEdit={handleEdit}
        />
      )}

      {view === 'home' ? (
        <HomeScreen
          currentTime={currentTime}
          data={data}
          onLogin={() => setView('login')}
          clockedInUsers={clockedInUsers}
        />
      ) : (
        <div className="flex flex-col h-full animate-fade-in">
          <div className="home-header">
            <div className="clock">{format(currentTime, 'h:mm a')}</div>
            <div className="date">{format(currentTime, 'EEEE, MMMM do')}</div>
          </div>

          <div className="grid">
            {data.users.filter(u => String(u.archived).toUpperCase() !== 'TRUE').map(user => {
              const status = getUserStatus(user.id);
              const initials = user.name ? user.name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase() : '?';
              return (
                <div key={user.id} className="card" onClick={() => { setSelectedUser(user); setModalType('pin'); }}>
                  <div className={`status-dot ${status.clockedIn ? 'status-in' : 'status-out'}`} />
                  <div className="avatar">{initials.substring(0, 2)}</div>
                  <div className="name">{user.name}</div>
                  <button className="btn-punch">
                    {status.clockedIn ? 'Clock Out' : 'Clock In'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="home-footer">
            <button className="btn-back" onClick={() => setView('home')}>
              ← Back to Leaderboard
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', padding: '1rem 1rem 0', alignItems: 'center' }}>
        <div className="flex gap-4">
          <History className="cursor-pointer opacity-60 hover:opacity-100" onClick={() => setShowLogs(true)} />
          <div
            className="cursor-pointer opacity-60 hover:opacity-100 flex items-center gap-1 text-xs"
            onClick={() => { setLoading(true); fetchData(); }}
          >
            Refresh Data
          </div>
        </div>
        <Settings className="cursor-pointer opacity-60 hover:opacity-100" onClick={handleAdminAuth} />
      </div>

      {modalType === 'pin' && renderPinPad()}
      {modalType === 'project' && renderProjectSelector()}
      {renderAdminModal()}


      {showLogs && (
        <div className="modal-overlay" onClick={() => setShowLogs(false)}>
          <div className="modal-content" style={{ maxWidth: '400px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="flex justify-between mb-4">
              <h3 className="modal-title" style={{ margin: 0 }}>Recent Activity</h3>
              <X onClick={() => setShowLogs(false)} className="cursor-pointer" />
            </div>
            <div className="project-list">
              {data.entries.slice(-20).reverse().map((log, i) => {
                let projectText = log.project;
                if (log.project && log.project.startsWith("SPLIT:")) {
                  try {
                    const splitData = JSON.parse(log.project.substring(6));
                    projectText = Object.entries(splitData)
                      .map(([p, h]) => `${p} (${Number(h).toFixed(1)}h)`)
                      .join(", ");
                  } catch {
                    projectText = "Invalid split data";
                  }
                }
                return (
                  <div key={i} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.8rem' }}>
                    <span style={{ color: log.type === 'IN' ? 'var(--status-in)' : 'var(--status-out)', fontWeight: 'bold' }}>{log.type}</span>
                    {' - '}{data.users.find(u => u.id == getVal(log, 'userid', 'userId', 'user id', 'uid'))?.name}
                    <div style={{ color: 'var(--text-muted)' }}>
                      {safeDateFormat(log.timestamp, 'MMM d, HH:mm:ss')}
                      {projectText && ` • ${projectText}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
