import React, { useState } from 'react';
import FileCard from './FileCard';
import './CardContainer.css';

interface Card {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path?: string;
  iconPath?: string | null;
}

interface CardContainerProps {
  id: string;
  name: string;
}

const CardContainer: React.FC<CardContainerProps> = ({ name }) => {
  const [cards, setCards] = useState<Card[]>([]);
  const [isHovering, setIsHovering] = useState(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);

    // 支持多文件拖拽
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const newCards: Card[] = [];

      for (const file of files) {
        // @ts-ignore - Electron file object has 'path' property
        const filePath = file.path;
        console.log(`Processing file: ${file.name}, path: ${filePath}`);

        // 通过 Electron API 检查是否为文件夹
        let isFolder = false;
        try {
          if (window.electronAPI?.isDirectory) {
            isFolder = await window.electronAPI.isDirectory(filePath);
            console.log(`Is directory: ${isFolder}`);
          } else {
            isFolder = !file.type;
            console.log(`Using file.type fallback for: ${file.name}`);
          }
        } catch (error) {
          console.error(`Error checking if directory: ${file.name}`, error);
          isFolder = !file.type;
        }

        // 获取文件图标（仅对文件）
        let iconPath: string | null | undefined;
        if (!isFolder && window.electronAPI?.getFileIcon) {
          try {
            console.log(`Getting icon for file: ${filePath}`);
            iconPath = await window.electronAPI.getFileIcon(filePath);
            if (iconPath) {
              console.log(`Successfully got icon for: ${file.name}`);
            } else {
              console.warn(`Failed to get icon for: ${file.name}`);
            }
          } catch (error) {
            console.error(`Error getting icon for ${file.name}:`, error);
          }
        }

        newCards.push({
          id: Date.now().toString() + Math.random().toString(),
          name: file.name,
          type: isFolder ? 'folder' : 'file',
          path: filePath,
          iconPath: iconPath
        });
      }
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
