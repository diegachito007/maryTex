import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import toast from 'react-hot-toast';

export function useNotifications(userId, userRole) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(!userId);
  const [permissionStatus, setPermissionStatus] = useState('default');
  
  const shownNotificationsRef = useRef(new Set());
  // ✅ NUEVO: Trackear si ya se mostró la advertencia de permisos
  const shownPermissionWarningRef = useRef(false);

  // ✅ LISTENER EN TIEMPO REAL
  useEffect(() => {
    if (!userId) return;

    let q;
    
    if (userRole === 'admin') {
      q = query(
        collection(db, 'notifications'),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notificationsData = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      setNotifications(notificationsData);
      
      const unread = notificationsData.filter(n => !n.read).length;
      setUnreadCount(unread);
      
      setLoading(false);

      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const newNotif = change.doc.data();
          
          if (shownNotificationsRef.current.has(newNotif.id)) {
            return;
          }
          
          if (!newNotif.read && newNotif.createdBy !== userId) {
            shownNotificationsRef.current.add(newNotif.id);
            
            // ✅ TOAST SOLO PARA NOTIFICACIONES NUEVAS (no para permisos)
            toast.custom((t) => (
              <div className={`${t.visible ? 'animate-slide-in' : 'animate-slide-out'} bg-white rounded-lg shadow-lg border-l-4 border-primary-500 p-4 max-w-sm`}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">{newNotif.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{newNotif.message}</p>
                  </div>
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ), {
              duration: 5000,
              position: 'top-center',
            });

            showBrowserNotification(newNotif);
            playNotificationSound();
          }
        }
      });
    }, (error) => {
      console.error('Error escuchando notificaciones:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, userRole]);

  // ✅ VERIFICAR PERMISOS SIN TOASTS
  useEffect(() => {
    const checkPermission = () => {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          setPermissionStatus('granted');
        } else if (Notification.permission === 'denied') {
          setPermissionStatus('denied');
          // ✅ MOSTRAR ADVERTENCIA SOLO UNA VEZ POR SESIÓN
          if (!shownPermissionWarningRef.current) {
            shownPermissionWarningRef.current = true;
            // Solo mostramos un toast breve la primera vez
            toast.error('🔕 Notificaciones bloqueadas', {
              duration: 3000,
              description: 'Toca el icono 🔕 para habilitar'
            });
          }
        } else {
          setPermissionStatus('default');
        }
      } else {
        setPermissionStatus('unsupported');
      }
    };

    checkPermission();
    
    // Verificar cada 10 segundos (menos frecuente)
    const interval = setInterval(checkPermission, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // ✅ MARCAR COMO LEÍDA
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
        readAt: new Date()
      });
    } catch (error) {
      console.error('Error marcando como leída:', error);
    }
  }, []);

  // ✅ MARCAR TODAS COMO LEÍDAS
  const markAllAsRead = useCallback(async () => {
    try {
      const unreadNotifs = notifications.filter(n => !n.read);
      
      const promises = unreadNotifs.map(notif => 
        updateDoc(doc(db, 'notifications', notif.id), {
          read: true,
          readAt: new Date()
        })
      );

      await Promise.all(promises);
    } catch (error) {
      console.error('Error marcando todas como leídas:', error);
    }
  }, [notifications]);

  // ✅ SOLICITAR PERMISOS SIN TOAST (solo cambia el estado)
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      setPermissionStatus('unsupported');
      return false;
    }

    if (Notification.permission === 'granted') {
      setPermissionStatus('granted');
      return true;
    }

    if (Notification.permission === 'denied') {
      setPermissionStatus('denied');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      return permission === 'granted';
    } catch (error) {
      console.error('Error solicitando permisos:', error);
      return false;
    }
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    permissionStatus,
    markAsRead,
    markAllAsRead,
    requestPermission
  };
}

function showBrowserNotification(notification) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    const notif = new Notification(notification.title, {
      body: notification.message,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: notification.id,
      requireInteraction: false,
      silent: false
    });

    notif.onclick = () => {
      window.focus();
      notif.close();
    };

    setTimeout(() => notif.close(), 5000);
  } catch (error) {
    console.error('Error mostrando notificación:', error);
  }
}

function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch {
    // Silenciosamente ignorar
  }
}