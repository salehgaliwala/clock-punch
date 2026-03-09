import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { History, X, Settings, Shield, Plus, Edit, Trash2, Clock } from 'lucide-react';
import './index.css';

// CONFIG: Replace this with your deployed Apps Script URL
const API_URL = 'https://script.google.com/macros/s/AKfycbxSfPlE3wEXi4ILaHKGtE66vF4e0b8LbPODxMLJEn2Jn-vew1GCSTVDwdA5bQ3cjcUi_g/exec';

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

  return Object.entries(projectTime)
    .sort((a, b) => b[1] - a[1]) // Sort by hours descending
    .filter(([name]) => name !== 'No Project'); // Filter out No Project from leaderboard if desired, or keep it
};

const Leaderboard = ({ entries, projects }) => {
  const totals = calculateProjectTotals(entries, projects);

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-title">Active Projects</div>
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
                <td>{e.project}</td>
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

const HomeScreen = ({ currentTime, data, onLogin }) => (
  <div className="flex flex-col h-full">
    <div className="home-header">
      <div className="clock">{format(currentTime, 'h:mm a')}</div>
      <div className="date">{format(currentTime, 'EEEE, MMMM do')}</div>
    </div>

    <Leaderboard entries={data.entries} projects={data.projects} />

    <button className="btn-proceed" onClick={onLogin}>
      <Clock size={24} />
    </button>
  </div>
);


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


  const fetchData = useCallback(async () => {
    if (!API_URL) {
      console.warn('API URL not set. Using mock data.');
      setData({
        users: [
          { id: '1', name: 'Alice Admin', pin: '1234', role: 'Admin' },
          { id: '2', name: 'Bob User', pin: '0000', role: 'User' }
        ],
        projects: [{ id: '1', name: 'Internal Dev' }],
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

  const handlePunch = async (project = '') => {
    const userStatus = getUserStatus(selectedUser.id);
    const type = userStatus.clockedIn ? 'OUT' : 'IN';

    try {
      setLoading(true);
      console.log('Sending punch:', { action: 'punch', userId: selectedUser.id, project, type });
      const resp = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'punch',
          userId: selectedUser.id,
          project,
          type
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
  };

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
    else if (type === 'entry') setFormData({ timestamp: item.timestamp, reason: '' });
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
      const { timestamp, reason } = formData;
      if (!timestamp || !reason) return alert('All fields are required');
      payload = {
        action: 'editentry',
        entryId: item.id,
        oldTimestamp: item.timestamp,
        newTimestamp: timestamp,
        adminId: 'SYSTEM',
        reason
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

  const handlePinSubmit = () => {
    const enteredPin = pin.toString().trim();

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
        setPin('');
      }
      return;
    }

    // User Login
    if (enteredPin === (selectedUser?.pin || '').toString().trim()) {
      const status = getUserStatus(selectedUser.id);
      if (status.clockedIn) {
        setModalType('project'); // Select project on Clock Out
      } else {
        handlePunch(); // Clock In immediately
      }
    } else {
      alert('Incorrect PIN');
      setPin('');
    }
  };

  const handleAdminAuth = () => {
    setModalMode('admin');
    setModalType('pin');
  };

  const getUserStatus = (userId) => {
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
      lastPunch: lastEntry ? lastEntry.timestamp : null
    };
  };

  const resetState = () => {
    setSelectedUser(null);
    setPin('');
    setModalType(null);
    setModalMode('user');
    setView('home');
  };


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
          <button className="pin-btn" style={{ color: 'var(--status-out)' }} onClick={() => setPin('')}>C</button>
          <button className="pin-btn" onClick={() => pin.length < 4 && setPin(pin + '0')}>0</button>
          <button className="pin-btn" style={{ color: 'var(--status-in)' }} onClick={handlePinSubmit}>OK</button>
        </div>
      </div>
    </div>
  );

  const renderProjectSelector = () => (
    <div className="modal-overlay animate-fade-in" onClick={resetState}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Select Project for Clock Out</div>
        <div className="project-list">
          {data.projects
            .filter(p =>
              String(p.archived).toUpperCase() !== 'TRUE' &&
              (p.status || '').toLowerCase() === 'active'
            )
            .map(p => (
              <div key={p.id} className="project-item" onClick={() => handlePunch(p.name)}>
                {p.name}
              </div>
            ))}
          <div className="project-item" style={{ fontStyle: 'italic' }} onClick={() => handlePunch('No Project')}>
            Skip / No Project
          </div>
        </div>
      </div>
    </div>
  );

  if (loading && data.users.length === 0) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
        <div className="loading-text">Loading App Data...</div>
      </div>
    );
  }

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
              return (
                <div key={user.id} className="card" onClick={() => { setSelectedUser(user); setModalType('pin'); }}>
                  <div className={`status-dot ${status.clockedIn ? 'status-in' : 'status-out'}`} />
                  <div className="avatar">{user.name.split(' ').map(n => n[0]).join('')}</div>
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
              {data.entries.slice(-20).reverse().map((log, i) => (
                <div key={i} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.8rem' }}>
                  <span style={{ color: log.type === 'IN' ? 'var(--status-in)' : 'var(--status-out)', fontWeight: 'bold' }}>{log.type}</span>
                  {' - '}{data.users.find(u => u.id == getVal(log, 'userid', 'userId', 'user id', 'uid'))?.name}
                  <div style={{ color: 'var(--text-muted)' }}>
                    {safeDateFormat(log.timestamp, 'MMM d, HH:mm:ss')}
                    {log.project && ` • ${log.project}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
