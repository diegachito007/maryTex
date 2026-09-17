import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Header } from './components/layout/Header';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './services/firebase';
import Login from './pages/Login';
import PendingApproval from './pages/PendingApproval';
import CompanyDashboard from './pages/CompanyDashboard';
import AdminDashboard from './pages/admin/Dashboard';
import Models from './pages/admin/Models';
import Library from './pages/admin/Library';
import Orders from './pages/admin/Orders';
import Users from './pages/admin/Users';
import Reports from './pages/admin/Reports';
import RegisterProductionAdmin from './pages/admin/RegisterProduction';
import MyProductionAdmin from './pages/admin/MyProduction';
import OperarioDashboard from './pages/operario/Dashboard';
import ActiveOrders from './pages/operario/ActiveOrders';
import RegisterProductionOperario from './pages/operario/RegisterProduction';
import MyProductionOperario from './pages/operario/MyProduction';

// ============ LAYOUT ADMIN CON BOTÓN CAMBIAR EMPRESA ============

function AdminLayout({ children }) {
  const navigate = useNavigate();
  const { selectedCompanyId, clearCompany } = useAuth();
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    const loadCompany = async () => {
      if (selectedCompanyId) {
        try {
          const companyDoc = await getDoc(doc(db, 'companies', selectedCompanyId));
          if (companyDoc.exists()) {
            setCompanyName(companyDoc.data().name);
          }
        } catch (error) {
          console.error('Error cargando empresa:', error);
        }
      }
    };
    loadCompany();
  }, [selectedCompanyId]);

  // Protección: Si no hay empresa seleccionada, redirigir al selector
  if (!selectedCompanyId) {
    return <Navigate to="/admin" replace />;
  }

  const handleChangeCompany = () => {
    clearCompany();
    navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        title={companyName || 'Cargando...'}
        onBack={() => navigate('/admin/dashboard')}
        onChangeCompany={handleChangeCompany}
        showChangeCompany={true}
      />
      {children}
    </div>
  );
}

// ============ LAYOUT OPERARIO CON BOTÓN CAMBIAR EMPRESA ============
// ✅ NUEVO: Similar al AdminLayout

function OperarioLayout({ children }) {
  const navigate = useNavigate();
  const { selectedCompanyId, clearCompany } = useAuth();
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    const loadCompany = async () => {
      if (selectedCompanyId) {
        try {
          const companyDoc = await getDoc(doc(db, 'companies', selectedCompanyId));
          if (companyDoc.exists()) {
            setCompanyName(companyDoc.data().name);
          }
        } catch (error) {
          console.error('Error cargando empresa:', error);
        }
      }
    };
    loadCompany();
  }, [selectedCompanyId]);

  // ✅ Protección: Si no hay empresa seleccionada, redirigir al selector
  if (!selectedCompanyId) {
    return <Navigate to="/operario" replace />;
  }

  const handleChangeCompany = () => {
    clearCompany();
    navigate('/operario');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        title={companyName || 'Cargando...'}
        onBack={() => navigate('/operario/dashboard')}
        onChangeCompany={handleChangeCompany}
        showChangeCompany={true}
      />
      {children}
    </div>
  );
}

// ============ RUTAS ============

function AppRoutes() {
  const { user, userData, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  const defaultRoute = userData?.role === 'admin' ? '/admin' : '/operario';

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={defaultRoute} /> : <Login />} />
      <Route path="/pending" element={<PendingApproval />} />
      
      {/* ============ ADMIN ============ */}
      
      {/* Selector de Empresas */}
      <Route path="/admin" element={
        <ProtectedRoute requiredRole="admin">
          <CompanyDashboard />
        </ProtectedRoute>
      } />
      
      {/* Dashboard del Admin */}
      <Route path="/admin/dashboard" element={
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <AdminDashboard />
          </AdminLayout>
        </ProtectedRoute>
      } />
      
      {/* Modelos */}
      <Route path="/admin/models" element={
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <Models />
          </AdminLayout>
        </ProtectedRoute>
      } />
      
      {/* Biblioteca */}
      <Route path="/admin/library" element={
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <Library />
          </AdminLayout>
        </ProtectedRoute>
      } />
      
      {/* Registrar Producción */}
      <Route path="/admin/register" element={
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <RegisterProductionAdmin />
          </AdminLayout>
        </ProtectedRoute>
      } />
      
      {/* Mi Producción */}
      <Route path="/admin/my-production" element={
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <MyProductionAdmin />
          </AdminLayout>
        </ProtectedRoute>
      } />
      
      {/* Órdenes */}
      <Route path="/admin/orders" element={
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <Orders />
          </AdminLayout>
        </ProtectedRoute>
      } />
      
      {/* Usuarios */}
      <Route path="/admin/users" element={
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <Users />
          </AdminLayout>
        </ProtectedRoute>
      } />
      
      {/* Reportes */}
      <Route path="/admin/reports" element={
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <Reports />
          </AdminLayout>
        </ProtectedRoute>
      } />
      
      {/* ============ OPERARIO ============ */}
      
      {/* ✅ Selector de Empresas (MISMO QUE ADMIN) */}
      <Route path="/operario" element={
        <ProtectedRoute requiredRole="operario">
          <CompanyDashboard />
        </ProtectedRoute>
      } />
      
      {/* ✅ Dashboard del Operario (con layout) */}
      <Route path="/operario/dashboard" element={
        <ProtectedRoute requiredRole="operario">
          <OperarioLayout>
            <OperarioDashboard />
          </OperarioLayout>
        </ProtectedRoute>
      } />
      
      {/* Órdenes Activas */}
      <Route path="/operario/orders" element={
        <ProtectedRoute requiredRole="operario">
          <OperarioLayout>
            <ActiveOrders />
          </OperarioLayout>
        </ProtectedRoute>
      } />
      
      {/* Registrar Producción */}
      <Route path="/operario/register" element={
        <ProtectedRoute requiredRole="operario">
          <OperarioLayout>
            <RegisterProductionOperario />
          </OperarioLayout>
        </ProtectedRoute>
      } />
      
      {/* Mi Producción */}
      <Route path="/operario/my-production" element={
        <ProtectedRoute requiredRole="operario">
          <OperarioLayout>
            <MyProductionOperario />
          </OperarioLayout>
        </ProtectedRoute>
      } />
      
      {/* Rutas por defecto */}
      <Route path="/" element={<Navigate to={user ? defaultRoute : '/login'} />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-center" />
      </AuthProvider>
    </BrowserRouter>
  );
}