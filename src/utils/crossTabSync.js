/**
 * Утилита для синхронизации состояния между вкладками браузера
 * Использует BroadcastChannel API для передачи сообщений между вкладками
 */
export class CrossTabSync {
  constructor(channelName) {
    this.channelName = channelName;
    this.channel = null;
    this.lastEventTime = 0;
    this.MIN_INTERVAL = 2000; // Минимум 2 секунды между обработкой событий
    this.callbacks = new Set();
    this.localCallback = null; // Callback для локального вызова (в той же вкладке)

    // Проверяем поддержку BroadcastChannel
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(channelName);
      this.setupListener();
    } else {
      console.warn('BroadcastChannel not supported, cross-tab sync disabled');
    }
  }

  /**
   * Настройка слушателя событий
   */
  setupListener() {
    if (!this.channel) return;

    this.channel.onmessage = (event) => {
      const { timestamp, ...data } = event.data;

      // Валидация timestamp (не из будущего и не старше 1 минуты)
      const now = Date.now();
      if (timestamp > now + 1000 || timestamp < now - 60000) {
        console.warn('[CrossTabSync] Invalid timestamp, ignoring:', timestamp);
        return;
      }

      // Rate limiting - не обрабатываем события чаще чем раз в 2 секунды
      if (now - this.lastEventTime < this.MIN_INTERVAL) {
        console.log('[CrossTabSync] Rate limit, ignoring event');
        return;
      }
      this.lastEventTime = now;

      // Вызываем все зарегистрированные callback'и
      this.callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error('[CrossTabSync] Callback error:', err);
        }
      });
    };
  }

  /**
   * Отправить сообщение во все другие вкладки
   * @param {Object} message - данные для отправки
   */
  send(message) {
    if (!this.channel) return;

    this.channel.postMessage({
      ...message,
      timestamp: Date.now()
    });
  }

  /**
   * Подписаться на сообщения от других вкладок
   * @param {Function} callback - функция обработки сообщений
   * @returns {Function} функция отписки
   */
  listen(callback) {
    this.callbacks.add(callback);

    // Сохраняем локальный callback для вызова из той же вкладки
    // (BroadcastChannel не доставляет события в ту же вкладку)
    if (this.callbacks.size === 1) {
      this.localCallback = callback;
    }

    // Возвращаем функцию для отписки
    return () => {
      this.callbacks.delete(callback);
      if (this.callbacks.size === 0) {
        this.localCallback = null;
      }
    };
  }

  /**
   * Закрыть канал связи
   */
  close() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.callbacks.clear();
  }
}

/**
 * Debounce функция - откладывает вызов функции до момента, когда пройдёт delay мс без новых вызовов
 * @param {Function} func - функция для debounce
 * @param {number} delay - задержка в миллисекундах
 * @returns {Function} debounced функция
 */
export function debounce(func, delay) {
  let timeoutId = null;

  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}
