import React from 'react';
import CardContainer from './CardContainer';
import './FileManager.css';

interface CardContainerType {
  id: string;
  name: string;
}

interface FileManagerProps {
  containers: CardContainerType[];
  onAddContainer: () => void;
}

const FileManager: React.FC<FileManagerProps> = ({ containers, onAddContainer }) => {
  return (
    <div className="file-manager">
      <div className="file-manager-content">
        {containers.map(container => (
          <CardContainer key={container.id} id={container.id} name={container.name} />
        ))}
      </div>
    </div>
  );
};

export default FileManager;
