import React from 'react';
import { FaCheckCircle, FaTimesCircle, FaSpinner, FaFileImage, FaTimes, FaChevronDown, FaChevronUp } from 'react-icons/fa';

const UploadProgressWidget = ({ uploads, onClose, minimized, toggleMinimized }) => {
    if (Object.keys(uploads).length === 0) return null;

    const files = Object.values(uploads);
    const finishedCount = files.filter(f => f.status === 'completed' || f.status === 'error').length;
    const totalCount = files.length;
    const isAllFinished = finishedCount === totalCount && totalCount > 0;

    return (
        <div className={`upload-widget ${minimized ? 'minimized' : ''}`}>
            <div className="upload-header" onClick={toggleMinimized}>
                <div className="upload-title">
                    {isAllFinished ? 'Uploads complete' : `Uploading ${finishedCount} of ${totalCount} items`}
                </div>
                <div className="upload-controls">
                    <button onClick={(e) => { e.stopPropagation(); toggleMinimized(); }} className="widget-btn">
                        {minimized ? <FaChevronUp /> : <FaChevronDown />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="widget-btn">
                        <FaTimes />
                    </button>
                </div>
            </div>

            {!minimized && (
                <div className="upload-list">
                    {files.map((file) => (
                        <div key={file.id} className="upload-item">
                            <div className="upload-icon">
                                <FaFileImage />
                            </div>
                            <div className="upload-info">
                                <div className="upload-name" title={file.name}>{file.name}</div>
                                <div className="upload-status">
                                    {file.status === 'uploading' && <span className="status-text uploading">Uploading...</span>}
                                    {file.status === 'pending' && <span className="status-text pending">Pending</span>}
                                    {file.status === 'completed' && <span className="status-text success">Completed</span>}
                                    {file.status === 'error' && <span className="status-text error">Error</span>}
                                </div>
                            </div>
                            <div className="upload-action">
                                {file.status === 'uploading' && <FaSpinner className="spinner-icon" />}
                                {file.status === 'completed' && <FaCheckCircle className="success-icon" />}
                                {file.status === 'error' && <FaTimesCircle className="error-icon" />}
                                {file.status === 'pending' && <div className="pending-circle" />}
                            </div>
                            {(file.status === 'uploading' || file.status === 'pending') && (
                                <div className="item-progress-bar" style={{ width: `${file.progress}%` }} />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default UploadProgressWidget;
