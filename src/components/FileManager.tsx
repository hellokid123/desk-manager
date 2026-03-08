import React from 'react';
import CardContainer from './CardContainer';
import './FileManager.css';

interface FileCard {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
}

interface CardContainerType {
  id: string;
  name: string;
  cards: FileCard[];
}

interface FileManagerProps {
  containers: CardContainerType[];
  onUpdateContainerCards: (containerId: string, cards: FileCard[]) => void;
}

const FileManager: React.FC<FileManagerProps> = ({
  containers,
  onUpdateContainerCards,
}) => {
  return (
    <div className="file-manager">
      <div className="file-manager-content">
        {containers.map((container) => (
          <CardContainer
            key={container.id}
            name={container.name}
            cards={container.cards}
            onUpdateCards={(cards) => onUpdateContainerCards(container.id, cards)}
          />
        ))}
      </div>
    </div>
  );
};

export default FileManager;
