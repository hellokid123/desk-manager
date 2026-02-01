import React, { useEffect, useRef, useState } from 'react';
import './ResizeFrame.css';

interface ResizeFrameProps {
  isLocked: boolean;
}

const ResizeFrame: React.FC<ResizeFrameProps> = ({ isLocked }) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [activeCursor, setActiveCursor] = useState('default');
  const [isMouseDown, setIsMouseDown] = useState(false);

  useEffect(() => {
    if (isLocked) {
      // 锁定状态下，清除所有光标效果
      setActiveCursor('default');
      if (frameRef.current) {
        frameRef.current.classList.remove(
          'resize-active',
          'resize-horizontal',
          'resize-vertical',
          'resize-corner-nwse',
          'resize-corner-nesw'
        );
      }
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!frameRef.current || isMouseDown) return;

      const rect = frameRef.current.getBoundingClientRect();
      const threshold = 10; // 检测边框的距离阈值

      const distToLeft = e.clientX - rect.left;
      const distToRight = rect.right - e.clientX;
      const distToTop = e.clientY - rect.top;
      const distToBottom = rect.bottom - e.clientY;

      const isLeft = distToLeft < threshold && distToLeft >= 0;
      const isRight = distToRight < threshold && distToRight >= 0;
      const isTop = distToTop < threshold && distToTop >= 0;
      const isBottom = distToBottom < threshold && distToBottom >= 0;

      let cursor = 'default';

      if ((isLeft || isRight) && (isTop || isBottom)) {
        // 角落
        if ((isLeft && isTop) || (isRight && isBottom)) {
          cursor = 'nwse-resize'; // 左上或右下
        } else {
          cursor = 'nesw-resize'; // 右上或左下
        }
      } else if (isLeft || isRight) {
        cursor = 'ew-resize'; // 左右
      } else if (isTop || isBottom) {
        cursor = 'ns-resize'; // 上下
      }

      setActiveCursor(cursor);

      // 更新边框高亮状态
      frameRef.current.classList.toggle('resize-active', cursor !== 'default');
      frameRef.current.classList.toggle('resize-horizontal', cursor === 'ew-resize');
      frameRef.current.classList.toggle('resize-vertical', cursor === 'ns-resize');
      frameRef.current.classList.toggle('resize-corner-nwse', cursor === 'nwse-resize');
      frameRef.current.classList.toggle('resize-corner-nesw', cursor === 'nesw-resize');
    };

    const handleMouseLeave = () => {
      setActiveCursor('default');
      if (frameRef.current) {
        frameRef.current.classList.remove(
          'resize-active',
          'resize-horizontal',
          'resize-vertical',
          'resize-corner-nwse',
          'resize-corner-nesw'
        );
      }
    };

    const handleMouseDown = () => {
      setIsMouseDown(true);
    };

    const handleMouseUp = () => {
      setIsMouseDown(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    frameRef.current?.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      frameRef.current?.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isLocked, isMouseDown]);

  return (
    <div
      ref={frameRef}
      className={`resize-frame ${isLocked ? 'locked' : ''}`}
      style={{ cursor: activeCursor }}
    />
  );
};

export default ResizeFrame;
