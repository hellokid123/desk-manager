import React from 'react';
import './TopBar.css';

interface TopBarProps {
  isLocked: boolean;
  onToggleLock: () => void;
  onOpenSettings: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ isLocked, onToggleLock, onOpenSettings }) => {
  const handleCloseApp = async () => {
    if (window.electronAPI) {
      await window.electronAPI.closeApp();
    }
  };

  return (
    <div className="top-bar">
      <h1 className="app-title">Desk Manager</h1>
      <div className="top-bar-buttons">
        <button
          className={`lock-button ${isLocked ? 'locked' : ''}`}
          onClick={onToggleLock}
          title={isLocked ? '解锁窗口' : '锁定窗口'}
        >
          {isLocked ? '🔒' : '🔓'}
        </button>
        <button
          className="settings-button"
          onClick={onOpenSettings}
          title="设置"
        >
          ⚙️
        </button>
        <button
          className="close-button"
          onClick={handleCloseApp}
          title="关闭应用"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default TopBar;
