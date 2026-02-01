import React, { useState } from 'react';
import FileCard from './FileCard';
import './CardContainer.css';

interface Card {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path?: string;
}

interface CardContainerProps {
  id: string;
  name: string;
}

const CardContainer: React.FC<CardContainerProps> = ({ id, name }) => {
  const [cards, setCards] = useState<Card[]>([]);
  const [isHovering, setIsHovering] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
    
    // 支持多文件拖拽
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const newCards: Card[] = files.map(file => {
        // @ts-ignore - Electron file object has 'path' property
        const filePath = file.path; 
        const isFolder = !file.type; // 简单判断，文件夹通常没有 mime type
        
        return {
          id: Date.now().toString() + Math.random().toString(),
          name: file.name,
          type: isFolder ? 'folder' : 'file',
          path: filePath
        };
      });
      setCards(prev => [...prev, ...newCards]);
      return;
    }

    // 兼容之前的纯文本路径拖拽（如果需要）
    const filePath = e.dataTransfer.getData('text/plain');
    if (filePath) {
      const isFolder = filePath.endsWith('\\') || filePath.endsWith('/');
      const newCard: Card = {
        id: Date.now().toString(),
        name: filePath.split('\\').pop() || filePath.split('/').pop() || filePath,
        type: isFolder ? 'folder' : 'file',
        path: filePath,
      };
      setCards([...cards, newCard]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
  };

  const handleRemoveCard = (cardId: string) => {
    setCards(cards.filter(card => card.id !== cardId));
  };

  return (
    <div
      className="card-container"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      style={{
        background: isHovering ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
        minHeight: '100%',
        flex: 1
      }}
    >
      <div className="card-container-header">
        <h3>{name}</h3>
      </div>
      <div className="card-container-body">
        {cards.length === 0 ? (
          <div className="empty-state">
            拖拽文件或文件夹到这里
          </div>
        ) : (
          cards.map(card => (
            <FileCard
              key={card.id}
              card={card}
              onRemove={() => handleRemoveCard(card.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default CardContainer;
