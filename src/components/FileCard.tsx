import React, { useState, useEffect } from 'react';
import './FileCard.css';

interface Card {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path?: string;
  iconPath?: string | null;
}

interface FileCardProps {
  card: Card;
  onRemove: () => void;
}

const FileCard: React.FC<FileCardProps> = ({ card, onRemove }) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleDoubleClick = () => {
    if (card.path && window.electronAPI?.openPath) {
      window.electronAPI.openPath(card.path);
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

  // 点击任何地方关闭菜单
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
        ) : card.iconPath ? (
          // 判断是否为 data URL 或 emoji
          card.iconPath.startsWith('data:') ? (
            <>
              <img
                src={card.iconPath}
                alt={card.name}
                style={{
                  width: '28px',
                  height: '28px',
                  objectFit: 'contain',
                  imageRendering: 'crisp-edges'
                }}
                onError={() => {
                  console.error('Failed to load icon image:', card.name);
                  setImageLoaded(false);
                }}
                onLoad={() => {
                  console.log('Icon loaded successfully:', card.name);
                  setImageLoaded(true);
                }}
              />
              {!imageLoaded && <span style={{ fontSize: '18px' }}>📄</span>}
            </>
          ) : (
            <span style={{ fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {card.iconPath}
            </span>
          )
        ) : (
          '📄'
        )}
      </div>
      <div className="file-card-name" title={card.name}>
        {card.name}
      </div>

      {/* 右键菜单 */}
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
