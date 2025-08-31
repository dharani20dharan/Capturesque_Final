// src/components/ConfirmModal.js

/**
 * This component renders a confirmation dialog (modal).
 * It is used to ask the user to confirm a critical action, such as deleting a file or folder.
 * It receives props to control its visibility, content, and actions.
 */
import React from 'react';
import { FaTimes, FaSpinner } from 'react-icons/fa';

export const ConfirmModal = ({ open, title, message, onConfirm, onCancel, loading }) => {
  if (!open) return null;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <button className="modal-close-btn" onClick={onCancel} aria-label="Close confirm dialog">
          <FaTimes />
        </button>
        <h3 id="confirm-title">{title}</h3>
        <p style={{ marginTop: 8 }}>{message}</p>
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className="btn danger" onClick={onConfirm} disabled={loading}>
            {loading ? <FaSpinner className="spinner-icon" /> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};