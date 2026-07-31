import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { postsAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import '../styles/ComposeReplyModal.css';

/**
 * Модальное окно для создания быстрого ответа (quick reply)
 * Открывается при клике на кнопку 💬 в Post компоненте
 *
 * Создаёт ответ с is_quick_reply = true, который:
 * - Отображается в табе "Посты" автора с цитируемой карточкой родителя
 * - Показывается в ленте новостей
 *
 * @param {Object} post - Пост на который отвечаем
 * @param {Function} onClose - Закрыть модал
 * @param {Function} onSuccess - Callback после создания ответа
 */
const ComposeReplyModal = ({ post, onClose, onSuccess }) => {
  const { user, t } = useAuth();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await postsAPI.create(text.trim(), post.id, true);
      if (onSuccess) onSuccess(res.data.post);
      onClose();
    } catch {
      setError(t('post_page.comment_error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
  };

  const content = (
    <div className="crm-overlay" onClick={onClose}>
      <div className="crm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="crm-header">
          <button className="crm-close" onClick={onClose}>×</button>
        </div>

        <div className="crm-body">
          <div className="crm-parent-post">
            <img
              src={post.avatar_url || `https://i.pravatar.cc/150?u=${post.username}`}
              alt="Avatar"
              className="avatar avatar-md"
            />
            <div className="crm-parent-content">
              <div className="crm-parent-meta">
                <span className="crm-parent-name">{post.display_name}</span>
                <span className="crm-parent-handle"> @{post.username}</span>
              </div>
              <p className="crm-parent-text">{post.content}</p>
            </div>
            <div className="crm-thread-line" />
          </div>

          <div className="crm-compose">
            <img
              src={user.avatar_url || `https://i.pravatar.cc/150?u=${user.username}`}
              alt="Your avatar"
              className="avatar avatar-md"
            />
            <div className="crm-compose-body">
              <div className="crm-replying-to">
                {t('profile.reply_to')} <span className="crm-reply-username">@{post.username}</span>
              </div>
              <textarea
                ref={textareaRef}
                className="crm-textarea"
                placeholder={t('post_page.comment_placeholder')}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={280}
                rows={3}
              />
              {error && <div className="crm-error">{error}</div>}
            </div>
          </div>
        </div>

        <div className="crm-footer">
          <span className="crm-count">{text.length}/280</span>
          <button
            className="crm-submit-btn"
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
          >
            {submitting ? t('post_page.comment_submitting') : t('post_page.comment_submit')}
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
};

export default ComposeReplyModal;
