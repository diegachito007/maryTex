import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldX, LogOut } from 'lucide-react';

export function ProtectedRoute({ children, requiredRole }) {
  const { user, userData, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Si el usuario está pendiente de aprobación
  if (userData?.status === 'pending') {
    return <Navigate to="/pending" replace />;
  }

  // Si el usuario fue rechazado o bloqueado
  if (userData?.status === 'rejected' || userData?.status === 'blocked') {
    const isBlocked = userData.status === 'blocked';
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          {/* Ícono */}
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
            isBlocked ? 'bg-gray-100' : 'bg-red-100'
          }`}>
            <ShieldX className={`w-10 h-10 ${isBlocked ? 'text-gray-600' : 'text-red-600'}`} />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isBlocked ? 'Cuenta bloqueada' : 'Cuenta rechazada'}
          </h1>
          
          <p className="text-gray-600 mb-6">
            Hola <strong>{userData?.name}</strong>,
          </p>

          <div className={`border rounded-lg p-4 mb-6 ${
            isBlocked 
              ? 'bg-gray-50 border-gray-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <p className={`text-sm ${isBlocked ? 'text-gray-800' : 'text-red-800'}`}>
              {isBlocked 
                ? 'Tu cuenta ha sido bloqueada por la administradora. Contacta con ella para más información.' 
                : 'Tu solicitud de acceso fue rechazada por la administradora.'}
            </p>
          </div>

          <p className="text-sm text-gray-500 mb-8">
            Si crees que esto es un error, contacta a la administradora del taller.
          </p>

          {/* Botones de acción */}
          <div className="space-y-3">
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition font-medium"
            >
              <LogOut className="w-5 h-5" />
              Cerrar sesión
            </button>
            
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 text-gray-600 hover:text-primary-600 px-6 py-3 rounded-lg hover:bg-gray-50 transition"
            >
              Ya fue solucionado, intentar de nuevo
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Si se requiere un rol específico
  if (requiredRole && userData?.role !== requiredRole) {
    const redirect = userData?.role === 'admin' ? '/admin' : '/operario';
    return <Navigate to={redirect} replace />;
  }

  return children;
}