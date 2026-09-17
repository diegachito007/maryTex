import { Bell, BellOff, Check, CheckCheck, AlertTriangle, Package } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState, useRef, useEffect } from 'react';

export function NotificationsPanel({ 
  notifications, 
  unreadCount, 
  onMarkAsRead, 
  onMarkAllAsRead,
  permissionStatus = 'default', // ✅ NUEVO
  onEnableNotifications // ✅ NUEVO
}) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type) => {
    switch (type) {
      case 'order_adjustment':
        return <Package className="w-5 h-5 text-amber-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default:
        return <Bell className="w-5 h-5 text-blue-600" />;
    }
  };

  const getBgColor = (type, read) => {
    if (read) return 'bg-white';
    
    switch (type) {
      case 'order_adjustment':
        return 'bg-amber-50';
      case 'warning':
        return 'bg-red-50';
      default:
        return 'bg-blue-50';
    }
  };

  // ✅ Determinar qué icono mostrar según permisos
  const renderBellIcon = () => {
    if (permissionStatus === 'denied') {
      return <BellOff className="w-6 h-6 text-orange-600" />;
    }
    if (permissionStatus === 'granted') {
      return <Bell className="w-6 h-6 text-green-600" />;
    }
    return <Bell className="w-6 h-6 text-gray-600" />;
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* ✅ UN SOLO BOTÓN CON ICONO DINÁMICO */}
      <button
        onClick={() => {
          if (permissionStatus === 'denied' && onEnableNotifications) {
            onEnableNotifications();
          } else {
            setIsOpen(!isOpen);
          }
        }}
        className="relative p-2 transition hover:bg-gray-100 rounded-lg"
        title={
          permissionStatus === 'denied' 
            ? 'Notificaciones bloqueadas - Toca para habilitar' 
            : permissionStatus === 'granted'
            ? 'Notificaciones activas'
            : 'Notificaciones'
        }
      >
        {renderBellIcon()}
        
        {/* Badge con contador (solo si hay no leídas) */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ✅ PANEL DESPLEGABLE (solo si no está denegado) */}
      {isOpen && permissionStatus !== 'denied' && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-gray-700" />
              <h3 className="font-bold text-gray-900">Notificaciones</h3>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                  {unreadCount}
                </span>
              )}
            </div>
            
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                <CheckCheck className="w-4 h-4" />
                Marcar todas
              </button>
            )}
          </div>

          {/* Lista de notificaciones */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No hay notificaciones</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.slice(0, 20).map(notif => (
                  <div
                    key={notif.id}
                    className={`p-4 transition hover:bg-gray-50 ${getBgColor(notif.type, notif.read)}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getIcon(notif.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className={`text-sm font-semibold ${notif.read ? 'text-gray-700' : 'text-gray-900'}`}>
                            {notif.title}
                          </p>
                          
                          {!notif.read && (
                            <button
                              onClick={() => onMarkAsRead(notif.id)}
                              className="flex-shrink-0 p-1 text-gray-400 hover:text-green-600 transition"
                              title="Marcar como leída"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <p className={`text-xs ${notif.read ? 'text-gray-500' : 'text-gray-700'} mb-2`}>
                          {notif.message}
                        </p>

                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>
                            {format(notif.createdAt.toDate(), "dd/MM/yyyy HH:mm", { locale: es })}
                          </span>
                          {notif.createdByName && (
                            <>
                              <span>•</span>
                              <span>Por: {notif.createdByName}</span>
                            </>
                          )}
                        </div>

                        {notif.difference && (
                          <div className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                            notif.difference > 0 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {notif.difference > 0 ? '📈' : '📉'}
                            {notif.difference > 0 ? '+' : ''}{notif.difference} unidades
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {notifications.length > 20 && (
            <div className="p-3 border-t border-gray-200 text-center">
              <p className="text-xs text-gray-500">
                Mostrando 20 de {notifications.length} notificaciones
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}