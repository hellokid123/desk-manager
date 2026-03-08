import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './FileCard.css';

interface Card {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
}

interface FileCardProps {
  card: Card;
  onRemove: () => void;
}

const FileCard: React.FC<FileCardProps> = ({ card, onRemove }) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const iconSrc =
    card.type === 'folder'
      ? null
      : `http://file-icon.localhost/${encodeURIComponent(card.path)}`;

  const handleDoubleClick = () => {
    if (card.path) {
      invoke('open_path', { filePath: card.path });
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleRemoveFromMenu = () => {
    onRemove();
    setContextMenu(null);
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [contextMenu]);

  return (
    <div
      className="file-card"
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      <div className="file-card-icon">
        {card.type === 'folder' ? (
          '📁'
        ) : iconSrc ? (
          <img
            src={iconSrc}
            alt={card.name}
            style={{
              width: '28px',
              height: '28px',
              objectFit: 'contain',
              imageRendering: 'crisp-edges',
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              const parent = (e.target as HTMLImageElement).parentElement;
              if (parent && !parent.querySelector('.fallback-icon')) {
                const span = document.createElement('span');
                span.className = 'fallback-icon';
                span.style.fontSize = '18px';
                span.textContent = '📄';
                parent.appendChild(span);
              }
            }}
          />
        ) : (
          '📄'
        )}
      </div>
      <div className="file-card-name" title={card.name}>
        {card.name}
      </div>

      {contextMenu && (
        <div
          className="file-card-context-menu"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={handleMenuClick}
        >
          <button className="context-menu-item delete" onClick={handleRemoveFromMenu}>
            删除
          </button>
        </div>
      )}
    </div>
  );
};

export default FileCard;
