import React from 'react';
import { FaFolder, FaPen, FaTrashAlt } from 'react-icons/fa';

const FolderCard = ({ folder, onOpen, onRename, onDelete, isAdmin }) => {
  return (
    <div key={folder.folderId} className="folder-card" onClick={() => onOpen(folder)} role="button" tabIndex={0}>
      <FaFolder className="folder-icon" />
      <h3 className="folder-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {folder.folderName}
        {isAdmin && (
          <button className="btn small" title="Rename" onClick={(e) => { e.stopPropagation(); onRename(folder); }}><FaPen /></button>
        )}
      </h3>
      {isAdmin && <button className="btn small danger folder-delete-btn" onClick={e => { e.stopPropagation(); onDelete(folder); }}><FaTrashAlt /></button>}
    </div>
  );
};

export default FolderCard;