import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import './RepliesSortDropdown.css';

/**
 * Выпадающий список для сортировки комментариев
 * @param {string} sortBy - Текущая сортировка ('recent', 'relevant', 'likes')
 * @param {function} onSortChange - Callback при изменении сортировки
 */
const RepliesSortDropdown = ({ sortBy, onSortChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useAuth();
  const dropdownRef = useRef(null);

  const sortOptions = [
    { value: 'recent', label: t('replies_sort.recent') || 'Recent' },
    { value: 'relevant', label: t('replies_sort.relevant') || 'Relevant' },
    { value: 'likes', label: t('replies_sort.likes') || 'Likes' }
  ];

  const currentLabel = sortOptions.find(opt => opt.value === sortBy)?.label || t('replies_sort.recent');

  // Закрытие при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (value) => {
    onSortChange(value);
    setIsOpen(false);
  };

  return (
    <div className="replies-sort-dropdown" ref={dropdownRef}>
      <button
        className="sort-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="sort-current">{currentLabel}</span>
        <span className="sort-arrow">›</span>
      </button>

      {isOpen && (
        <div className="sort-dropdown-menu">
          <div className="sort-dropdown-header">{t('replies_sort.title') || 'Sort replies'}</div>
          {sortOptions.map((option) => (
            <button
              key={option.value}
              className={`sort-option ${sortBy === option.value ? 'active' : ''}`}
              onClick={() => handleSelect(option.value)}
            >
              <span className="sort-option-label">{option.label}</span>
              {sortBy === option.value && (
                <span className="sort-option-check">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RepliesSortDropdown;
