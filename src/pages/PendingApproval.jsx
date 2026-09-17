import { useAuth } from '../context/AuthContext';
import { LogOut, Clock, RefreshCw } from 'lucide-react';

export default function PendingApproval() {
  const { userData, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
        {/* Ícono */}
        <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-10 h-10 text-yellow-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Cuenta en revisión</h1>
        <p className="text-gray-600 mb-6">
          Hola <strong>{userData?.name}</strong>, tu cuenta fue registrada exitosamente.
        </p>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            La administradora debe aprobar tu cuenta antes de que puedas usar la aplicación.
          </p>
        </div>

        <p className="text-sm text-gray-500 mb-8">
          Recibirás una notificación cuando tu cuenta sea aprobada.
        </p>

        {/* Botones de acción */}
        <div className="space-y-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition font-medium"
          >
            <LogOut className="w-5 h-5" />
            Cerrar sesión
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="w-full flex items-center justify-center gap-2 text-gray-600 hover:text-primary-600 px-6 py-3 rounded-lg hover:bg-gray-50 transition"
          >
            <RefreshCw className="w-5 h-5" />
            Ya me aprobaron, intentar de nuevo
          </button>
        </div>
      </div>
    </div>
  );
}