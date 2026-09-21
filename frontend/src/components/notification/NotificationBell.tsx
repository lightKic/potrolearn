import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationServiceAPI } from '../../services/notification.service';
import { NotificationItem } from '../../types/notification';

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} d`;
  return date.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
}

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = async () => {
    try {
      const res = await NotificationServiceAPI.getUnreadCount();
      setUnreadCount(res.count);
    } catch (err) {
      console.error('[NOTIFICATIONS] Error fetching unread count:', err);
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await NotificationServiceAPI.getNotifications(30);
      setNotifications(data);
      // Recalculate unread count based on loaded notifications if needed
      const unread = data.filter((n) => !n.readAt).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error('[NOTIFICATIONS] Error fetching notifications list:', err);
      setError('No pudimos cargar tus notificaciones.');
    } finally {
      setLoading(false);
    }
  };

  // Initial load for unread count
  useEffect(() => {
    fetchUnreadCount();
  }, []);

  // Handle click outside and Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const togglePopover = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      fetchNotifications();
    }
  };

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await NotificationServiceAPI.markAllAsRead();
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
    } catch (err) {
      console.error('[NOTIFICATIONS] Failed to mark all as read:', err);
    }
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    // If unread, mark as read
    if (!item.readAt) {
      try {
        await NotificationServiceAPI.markAsRead(item.id);
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n))
        );
      } catch (err) {
        console.error('[NOTIFICATIONS] Failed to mark notification as read:', err);
      }
    }

    setIsOpen(false);
    if (item.link) {
      navigate(item.link);
    }
  };

  return (
    <div className="notification-bell-container" ref={containerRef}>
      <button
        className="notification-bell-btn"
        id="notification-bell-toggle"
        onClick={togglePopover}
        aria-label={`Notificaciones${unreadCount > 0 ? `, ${unreadCount} no leídas` : ''}`}
        aria-expanded={isOpen}
        title="Notificaciones"
      >
        <svg
          className="bell-icon"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>

        {unreadCount > 0 && (
          <span className="notification-badge" id="notification-unread-count">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-popover" id="notification-popover-panel" role="dialog" aria-label="Panel de notificaciones">
          <div className="notif-popover-header">
            <h3 className="notif-popover-title">Notificaciones</h3>
            <button
              className="notif-mark-all-btn"
              id="notif-mark-all-read"
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0 || loading}
            >
              Marcar todas como leídas
            </button>
          </div>

          <div className="notif-popover-content">
            {loading && (
              <div className="notif-loading-state">
                <div className="notif-spinner" />
                <span>Cargando notificaciones...</span>
              </div>
            )}

            {!loading && error && (
              <div className="notif-error-state">
                <p>{error}</p>
                <button className="notif-retry-btn" onClick={fetchNotifications}>
                  Reintentar
                </button>
              </div>
            )}

            {!loading && !error && notifications.length === 0 && (
              <div className="notif-empty-state">
                <svg
                  viewBox="0 0 24 24"
                  width="36"
                  height="36"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: '#94a3b8', marginBottom: 8 }}
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <p className="notif-empty-title">No tienes notificaciones</p>
                <p className="notif-empty-desc">Las novedades sobre tus cursos y evaluaciones aparecerán aquí.</p>
              </div>
            )}

            {!loading && !error && notifications.length > 0 && (
              <div className="notif-list">
                {notifications.map((item) => {
                  const isUnread = !item.readAt;
                  return (
                    <div
                      key={item.id}
                      className={`notif-item ${isUnread ? 'unread' : 'read'}`}
                      onClick={() => handleNotificationClick(item)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleNotificationClick(item);
                        }
                      }}
                    >
                      <div className="notif-item-header">
                        <span className="notif-item-title">{item.title}</span>
                        {isUnread && <span className="notif-unread-dot" title="No leída" />}
                      </div>
                      <p className="notif-item-message">{item.message}</p>
                      <span className="notif-item-time">{formatRelativeTime(item.createdAt)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
