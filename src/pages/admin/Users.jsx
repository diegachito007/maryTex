import { useEffect, useState } from 'react';
import { collection, doc, updateDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { UserCheck, UserX, Shield, ShieldOff, Users as UsersIcon, Clock, CheckCircle, XCircle } from 'lucide-react';
import { db } from '../../services/firebase';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('pending');

  // Cargar usuarios al montar el componente
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {
        toast.error('Error al cargar usuarios');
      }
    };
    loadUsers();
  }, []);

  const updateStatus = async (userId, newStatus) => {
    try {
      await updateDoc(doc(db, 'users', userId), { status: newStatus });
      
      const messages = {
        approved: 'Usuario aprobado',
        rejected: 'Usuario rechazado',
        blocked: 'Usuario bloqueado'
      };
      toast.success(messages[newStatus]);
      
      // Recargar usuarios
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      toast.error('Error al actualizar');
    }
  };

  const toggleRole = async (user) => {
    const newRole = user.role === 'admin' ? 'operario' : 'admin';
    try {
      await updateDoc(doc(db, 'users', user.id), { role: newRole });
      toast.success(`Rol cambiado a ${newRole}`);
      
      // Recargar usuarios
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      toast.error('Error al cambiar rol');
    }
  };

  const filteredUsers = users.filter(u => u.status === filter);

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      blocked: 'bg-gray-200 text-gray-700'
    };
    const labels = {
      pending: 'Pendiente',
      approved: 'Aprobado',
      rejected: 'Rechazado',
      blocked: 'Bloqueado'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const getRoleBadge = (role) => {
    return role === 'admin' 
      ? <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Admin</span>
      : <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Operario</span>;
  };

  const counts = {
    pending: users.filter(u => u.status === 'pending').length,
    approved: users.filter(u => u.status === 'approved').length,
    blocked: users.filter(u => u.status === 'blocked').length,
    rejected: users.filter(u => u.status === 'rejected').length
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Usuarios</h2>
        <p className="text-gray-500 text-sm">{users.length} usuarios registrados</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {[
          { key: 'pending', label: 'Pendientes', icon: Clock, count: counts.pending },
          { key: 'approved', label: 'Activos', icon: CheckCircle, count: counts.approved },
          { key: 'blocked', label: 'Bloqueados', icon: XCircle, count: counts.blocked },
          { key: 'rejected', label: 'Rechazados', icon: UserX, count: counts.rejected }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              filter === tab.key 
                ? 'bg-primary-600 text-white shadow' 
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                filter === tab.key ? 'bg-white/20' : 'bg-gray-100'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista de usuarios */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
          <UsersIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No hay usuarios {filter === 'pending' ? 'pendientes' : 'en esta categoría'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map(user => (
            <div key={user.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                {user.photoUrl ? (
                  <img 
                    src={user.photoUrl} 
                    alt={user.name} 
                    className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-accent-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{user.name}</h3>
                      <p className="text-sm text-gray-500 truncate">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {getRoleBadge(user.role)}
                    {getStatusBadge(user.status)}
                  </div>

                  {/* Acciones */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {user.status === 'pending' && (
                      <>
                        <Button 
                          size="sm" 
                          onClick={() => updateStatus(user.id, 'approved')}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <UserCheck className="w-4 h-4 mr-1" />Aprobar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => updateStatus(user.id, 'rejected')}
                        >
                          <UserX className="w-4 h-4 mr-1" />Rechazar
                        </Button>
                      </>
                    )}

                    {user.status === 'approved' && (
                      <>
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => updateStatus(user.id, 'blocked')}
                        >
                          <ShieldOff className="w-4 h-4 mr-1" />Bloquear
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => toggleRole(user)}
                        >
                          {user.role === 'admin' ? (
                            <>
                              <ShieldOff className="w-4 h-4 mr-1" />Quitar admin
                            </>
                          ) : (
                            <>
                              <Shield className="w-4 h-4 mr-1" />Hacer admin
                            </>
                          )}
                        </Button>
                      </>
                    )}

                    {user.status === 'blocked' && (
                      <Button 
                        size="sm" 
                        onClick={() => updateStatus(user.id, 'approved')}
                      >
                        <UserCheck className="w-4 h-4 mr-1" />Desbloquear
                      </Button>
                    )}

                    {user.status === 'rejected' && (
                      <Button 
                        size="sm" 
                        onClick={() => updateStatus(user.id, 'approved')}
                      >
                        <UserCheck className="w-4 h-4 mr-1" />Aprobar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>💡 Tip:</strong> Los usuarios nuevos aparecen en "Pendientes". 
          Apruébalos para que puedan usar la app. Puedes cambiar el rol de operario a admin en cualquier momento.
        </p>
      </div>
    </div>
  );
}