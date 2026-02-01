import React from 'react';
import './FileCard.css';

interface Card {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path?: string;
}

interface FileCardProps {
  card: Card;
  onRemove: () => void;
}

const FileCard: React.FC<FileCardProps> = ({ card, onRemove }) => {
  const handleDoubleClick = () => {
    if (card.path && window.electronAPI?.openPath) {
      window.electronAPI.openPath(card.path);
    }
  };

  return (
    <div className="file-card" onDoubleClick={handleDoubleClick}>
      <div className="file-card-icon">
        {card.type === 'folder' ? '📁' : '📄'}
      </div>
      <div className="file-card-name" title={card.name}>
        {card.name}
      </div>
      <button className="file-card-remove" onClick={onRemove}>
        ×
      </button>
    </div>
  );
};

export default FileCard;
