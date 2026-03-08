import React from 'react';
import FileCard from './FileCard';
import './CardContainer.css';

interface Card {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
}

interface CardContainerProps {
  name: string;
  cards: Card[];
  onUpdateCards: (cards: Card[]) => void;
}

const CardContainer: React.FC<CardContainerProps> = ({ name, cards, onUpdateCards }) => {
  const handleRemoveCard = (cardId: string) => {
    onUpdateCards(cards.filter((card) => card.id !== cardId));
  };

  return (
    <div
      className="card-container"
      style={{
        minHeight: '100%',
        flex: 1,
      }}
    >
      <div className="card-container-header">
        <h3>{name}</h3>
      </div>
      <div className="card-container-body">
        {cards.length === 0 ? (
          <div className="empty-state">拖拽文件或文件夹到这里</div>
        ) : (
          cards.map((card) => (
            <FileCard key={card.id} card={card} onRemove={() => handleRemoveCard(card.id)} />
          ))
        )}
      </div>
    </div>
  );
};

export default CardContainer;
