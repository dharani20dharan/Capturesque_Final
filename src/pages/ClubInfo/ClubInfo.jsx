import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaInstagram, FaPen, FaTrashAlt, FaPlus, FaSpinner } from 'react-icons/fa';
import './ClubInfo.css';
import { API_BASE_URL } from '../Gallery/config.js';
import { getCurrentUser } from '../Gallery/helper.js';

const ClubInfo = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null); // null = adding new member
  const [formData, setFormData] = useState({
    name: '',
    photo: '/images/avatar_placeholder.png',
    quote: '',
    instagram: '',
    instaLink: '',
    role_type: 'poc',
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Authenticated user check
  const user = getCurrentUser();
  const isAdmin = !!(user && (user.role === 'admin' || user.is_admin === true));

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/members`);
      setMembers(res.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load team members. Please check if the server is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleOpenAdd = (roleType) => {
    setEditingMember(null);
    setFormData({
      name: '',
      photo: '/images/avatar_placeholder.png',
      quote: '',
      instagram: '',
      instaLink: '',
      role_type: roleType,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (member) => {
    setEditingMember(member);
    setFormData({
      name: member.name || '',
      photo: member.photo || '/images/avatar_placeholder.png',
      quote: member.quote || '',
      instagram: member.instagram || '',
      instaLink: member.instaLink || '',
      role_type: member.role_type || 'poc',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (memberId, memberName) => {
    if (!window.confirm(`Are you sure you want to remove "${memberName}" from the team?`)) {
      return;
    }
    try {
      await axios.delete(`${API_BASE_URL}/api/admin/members/${memberId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchMembers();
    } catch (err) {
      console.error(err);
      alert("Failed to delete member: " + (err.response?.data?.error || err.message));
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const data = new FormData();
    data.append('file', file);

    setUploading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/admin/members/upload-avatar`, data, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setFormData(prev => ({ ...prev, photo: res.data.photoUrl }));
    } catch (err) {
      console.error(err);
      alert("Failed to upload avatar: " + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("Name is required");
      return;
    }

    setSubmitting(true);
    try {
      const config = {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      };

      if (editingMember) {
        // PUT edit
        await axios.put(`${API_BASE_URL}/api/admin/members/${editingMember.id}`, formData, config);
      } else {
        // POST create
        await axios.post(`${API_BASE_URL}/api/admin/members`, formData, config);
      }

      setIsModalOpen(false);
      fetchMembers();
    } catch (err) {
      console.error(err);
      alert("Failed to save member: " + (err.response?.data?.error || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  // Grouping members
  const clubHeads = members.filter(m => m.role_type === 'head');
  const coreCommittee = members.filter(m => m.role_type === 'core');
  const pocMembers = members.filter(m => m.role_type === 'poc');

  // Reusable Member Grid Component
  const MemberGrid = ({ title, members, roleType }) => (
    <section className="member-section">
      <h2 className="section-title" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {title}
        {isAdmin && (
          <button 
            className="add-member-section-btn" 
            onClick={() => handleOpenAdd(roleType)}
            title={`Add to ${title}`}
          >
            <FaPlus size={12} /> Add
          </button>
        )}
      </h2>
      
      <div className="members-grid">
        {members.map((member, index) => (
          <div className="member-card" key={member.id || member.name} style={{ animationDelay: `${0.05 * index}s` }}>
            {isAdmin && (
              <div className="member-card-actions">
                <button 
                  className="member-action-btn edit" 
                  onClick={() => handleOpenEdit(member)}
                  title="Edit details"
                >
                  <FaPen size={12} />
                </button>
                <button 
                  className="member-action-btn delete" 
                  onClick={() => handleDelete(member.id, member.name)}
                  title="Remove member"
                >
                  <FaTrashAlt size={12} />
                </button>
              </div>
            )}

            <div className="member-photo-wrapper">
              <img
                src={member.photo.startsWith('http') || member.photo.startsWith('/') ? (member.photo.startsWith('/Members/') ? `${API_BASE_URL}${member.photo}` : member.photo) : '/images/avatar_placeholder.png'}
                alt={`${member.name}`}
                className="member-photo"
                onError={(e) => {
                  e.target.src = '/images/avatar_placeholder.png';
                }}
              />
            </div>
            <h3 className="member-name">{member.name}</h3>
            {member.quote && <p className="member-quote">"{member.quote}"</p>}
            
            {member.instagram && (
              <a
                href={member.instaLink || `https://www.instagram.com/${member.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="insta-link"
                aria-label={`${member.name}'s Instagram profile`}
              >
                <FaInstagram className="insta-icon" />
                <span>{member.instagram}</span>
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="club-info-page">
      <div className="club-info-container">
        <h1 className="page-title">Meet Our Team</h1>
        <p className="intro-text">
          Driven by passion and creativity, our members are the heartbeat of Capturesque. Get to know the faces behind the lens.
        </p>

        {loading ? (
          <div style={{ padding: '60px 0', fontSize: '1.2rem', color: '#1f2937', fontWeight: 600 }}>
            <FaSpinner className="spinner-icon" style={{ marginRight: 8 }} /> Loading team details...
          </div>
        ) : error ? (
          <div style={{ padding: '40px 20px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: 8, color: '#ef4444', margin: '20px 0' }}>
            {error}
          </div>
        ) : (
          <>
            <MemberGrid title="Club Heads" members={clubHeads} roleType="head" />
            <MemberGrid title="Core Committee" members={coreCommittee} roleType="core" />
            <MemberGrid title="POC Members" members={pocMembers} roleType="poc" />
          </>
        )}
      </div>

      {/* Add / Edit Member Modal Popup */}
      {isModalOpen && (
        <div className="member-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="member-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="member-modal-title">
              {editingMember ? 'Edit Team Member' : 'Add Team Member'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div className="member-form-group">
                <label className="member-form-label">Full Name *</label>
                <input 
                  type="text" 
                  className="member-form-input" 
                  value={formData.name} 
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required 
                  placeholder="e.g. Dharanidharan"
                />
              </div>

              <div className="member-form-group">
                <label className="member-form-label">Role Category</label>
                <select 
                  className="member-form-select"
                  value={formData.role_type}
                  onChange={e => setFormData(prev => ({ ...prev, role_type: e.target.value }))}
                >
                  <option value="head">Club Head</option>
                  <option value="core">Core Committee</option>
                  <option value="poc">POC Member</option>
                </select>
              </div>

              <div className="member-form-group">
                <label className="member-form-label">Avatar / Photo</label>
                <div className="member-file-upload-wrapper">
                  <img 
                    src={formData.photo.startsWith('/Members/') ? `${API_BASE_URL}${formData.photo}` : formData.photo} 
                    alt="Preview" 
                    className="member-avatar-preview"
                    onError={e => e.target.src = '/images/avatar_placeholder.png'}
                  />
                  <label className="member-upload-btn-label">
                    {uploading ? 'Uploading...' : 'Choose File'}
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: 'none' }} 
                      onChange={handleAvatarUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>
              </div>

              <div className="member-form-group">
                <label className="member-form-label">Quote</label>
                <textarea 
                  className="member-form-textarea"
                  value={formData.quote}
                  onChange={e => setFormData(prev => ({ ...prev, quote: e.target.value }))}
                  placeholder="e.g. Photography is the story I fail to put into words."
                />
              </div>

              <div className="member-form-group">
                <label className="member-form-label">Instagram Username</label>
                <input 
                  type="text" 
                  className="member-form-input" 
                  value={formData.instagram} 
                  onChange={e => setFormData(prev => ({ ...prev, instagram: e.target.value }))}
                  placeholder="e.g. @this_is_dharanidharan"
                />
              </div>

              <div className="member-form-group">
                <label className="member-form-label">Instagram Profile Link</label>
                <input 
                  type="url" 
                  className="member-form-input" 
                  value={formData.instaLink} 
                  onChange={e => setFormData(prev => ({ ...prev, instaLink: e.target.value }))}
                  placeholder="e.g. https://www.instagram.com/this_is_dharanidharan"
                />
              </div>

              <div className="member-modal-actions">
                <button 
                  type="button" 
                  className="member-modal-btn cancel" 
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="member-modal-btn submit" 
                  disabled={submitting || uploading}
                >
                  {submitting ? 'Saving...' : 'Save Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClubInfo;