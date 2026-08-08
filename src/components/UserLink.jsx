import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import UserHoverCard from './UserHoverCard';

const UserLink = ({ username, children, className, to, ...props }) => {
  const [showCard, setShowCard] = useState(false);
  const [cardPosition, setCardPosition] = useState({ x: 0, y: 0 });
  const linkRef = useRef(null);
  const showTimeoutRef = useRef(null);
  const hideTimeoutRef = useRef(null);
  const isOverCardRef = useRef(false);

  const handleMouseEnter = (e) => {
    // Отменяем таймер скрытия если был
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    // Задержка перед показом карточки (500ms)
    showTimeoutRef.current = setTimeout(() => {
      if (linkRef.current) {
        const rect = linkRef.current.getBoundingClientRect();

        // Позиционируем карточку под элементом со смещением.
        // Карточка рендерится в портал с position: fixed, поэтому
        // координаты берём относительно viewport (без scrollY) —
        // так позиционирование не зависит от position: relative
        // родительских контейнеров (например, .tweet в ленте постов).
        setCardPosition({
          x: rect.left,
          y: rect.bottom + 10
        });
        setShowCard(true);
      }
    }, 500);
  };

  const handleMouseLeave = () => {
    // Отменяем таймер показа если был
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }

    // Задержка перед скрытием карточки (300ms)
    hideTimeoutRef.current = setTimeout(() => {
      if (!isOverCardRef.current) {
        setShowCard(false);
      }
    }, 300);
  };

  const handleCardMouseEnter = () => {
    isOverCardRef.current = true;

    // Отменяем скрытие если курсор над карточкой
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const handleCardMouseLeave = () => {
    isOverCardRef.current = false;
    setShowCard(false);
  };

  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  const linkTo = to || `/profile/${username}`;

  return (
    <>
      <Link
        ref={linkRef}
        to={linkTo}
        className={className}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {children}
      </Link>

      {showCard && createPortal(
        <UserHoverCard
          username={username}
          position={cardPosition}
          onMouseEnter={handleCardMouseEnter}
          onMouseLeave={handleCardMouseLeave}
        />,
        document.body
      )}
    </>
  );
};

export default UserLink;
