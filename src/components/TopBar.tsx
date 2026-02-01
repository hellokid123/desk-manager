import React from 'react';
import './TopBar.css';

interface TopBarProps {
  isLocked: boolean;
  onToggleLock: () => void;
  onOpenSettings: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ isLocked, onToggleLock, onOpenSettings }) => {
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
      </div>
    </div>
  );
};

export default TopBar;
