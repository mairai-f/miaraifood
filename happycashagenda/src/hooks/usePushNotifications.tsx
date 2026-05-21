import { useEffect, useCallback } from 'react';

export const usePushNotifications = () => {
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('Este navegador não suporta notificações');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }, []);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    }
    return null;
  }, []);

  const isSupported = 'Notification' in window;
  const permission = isSupported ? Notification.permission : 'denied';

  return {
    requestPermission,
    sendNotification,
    isSupported,
    permission,
  };
};
