import { LogOut, Menu, X, ArrowLeft, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import { NotificationsPanel } from './NotificationsPanel';
import { useState, useEffect } from 'react';

export function Header({ title, onBack, onChangeCompany, showChangeCompany }) {
  const { userData, logout, selectedCompanyId } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const { 
    notifications, 
    unreadCount, 
    permissionStatus,
    markAsRead, 
    markAllAsRead,
    requestPermission 
  } = useNotifications(userData?.uid, userData?.role);

  useEffect(() => {
    if (userData && permissionStatus === 'default') {
      requestPermission();
    }
  }, [userData, permissionStatus, requestPermission]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Silencioso
    }
  };

  // ✅ Manejar clic en campana cuando está bloqueada
  const handleEnableNotifications = async () => {
    if (permissionStatus === 'denied') {
      alert('Para habilitar notificaciones:\n\n1. Toca el candado  en la URL\n2. Configuración del sitio\n3. Notificaciones → Permitir\n4. Recarga la página');
    } else {
      await requestPermission();
    }
  };

  const firstName = userData?.name?.split(' ')[0] || '';
  const userRole = userData?.role === 'admin' ? 'Admin' : 'Operario';

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            
            <div>
              <h1 className="text-lg font-bold text-gray-900">{title}</h1>
              {userData?.name && (
                <p className="text-xs text-gray-500">
                  {firstName} • {userRole}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* ✅ UN SOLO COMPONENTE DE NOTIFICACIONES */}
            <NotificationsPanel
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              permissionStatus={permissionStatus}
              onEnableNotifications={handleEnableNotifications}
            />

            {showChangeCompany && onChangeCompany && selectedCompanyId && (
              <button
                onClick={onChangeCompany}
                className="hidden md:flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              >
                <Building2 className="w-4 h-4" />
                <span>Cambiar empresa</span>
              </button>
            )}

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition md:hidden"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition font-medium"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-gray-200 animate-fade-in">
            {showChangeCompany && onChangeCompany && selectedCompanyId && (
              <button
                onClick={() => {
                  onChangeCompany();
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition"
              >
                <Building2 className="w-5 h-5 text-gray-600" />
                <span className="font-medium">Cambiar empresa</span>
              </button>
            )}
            
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition font-medium"
            >
              <LogOut className="w-5 h-5" />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  );
}