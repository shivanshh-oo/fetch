import React from 'react';

export default function Toast({ show, message }) {
  return (
    <div className={`toast-container ${show ? 'show' : ''}`} id="toastContainer">
      <div className="toast-box">
        <i className="fas fa-check"></i>
        <span>{message}</span>
      </div>
    </div>
  );
}
