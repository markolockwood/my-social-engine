import React from 'react';
import './UserDisplayName.css';

/**
 * Компонент для отображения имени пользователя с иконкой замка для защищённых аккаунтов
 */
const UserDisplayName = ({ displayName, isProtected, className = '' }) => {
  return (
    <span className={`user-display-name ${className}`}>
      {displayName}
      {isProtected && <span className="protected-icon">🔒</span>}
    </span>
  );
};

export default UserDisplayName;
