import React from 'react';
import './SettingsPanel.css';

interface SettingsPanelProps {
  transparency: number;
  onTransparencyChange: (value: number) => void;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  transparency,
  onTransparencyChange,
  onClose,
}) => {
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>设置</h2>
          <button className="settings-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="settings-content">
          <div className="setting-item">
            <label htmlFor="transparency">窗口透明度: {transparency}%</label>
            <input
              id="transparency"
              type="range"
              min="0"
              max="100"
              value={transparency}
              onInput={(e) => onTransparencyChange(Number((e.target as HTMLInputElement).value))}
              className="setting-slider"
            />
          </div>
        </div>

        <div className="settings-footer">
          <button className="settings-close-button" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
