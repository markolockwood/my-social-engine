import React from 'react';
import './ConfirmModal.css';

const ConfirmModal = ({ isOpen, title, message, confirmText, cancelText, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="confirm-modal-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="confirm-modal-title">{title}</h2>
        <p className="confirm-modal-message">{message}</p>

        <div className="confirm-modal-buttons">
          <button className="confirm-modal-btn confirm-modal-btn-primary" onClick={onConfirm}>
            {confirmText}
          </button>
          <button className="confirm-modal-btn confirm-modal-btn-secondary" onClick={onCancel}>
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
