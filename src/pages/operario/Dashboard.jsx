import { Link } from 'react-router-dom';
import { ClipboardList, PlusCircle, BarChart3 } from 'lucide-react';

export default function OperarioDashboard() {
  const menu = [
    { 
      to: '/operario/orders', 
      icon: ClipboardList, 
      label: 'Órdenes Activas', 
      desc: 'Ver modelos y cantidades disponibles', 
      color: 'bg-green-500'
    },
    { 
      to: '/operario/register', 
      icon: PlusCircle, 
      label: 'Registrar Producción', 
      desc: 'Registrar tu trabajo del día', 
      color: 'bg-blue-500'
    },
    { 
      to: '/operario/my-production', 
      icon: BarChart3, 
      label: 'Mi Producción', 
      desc: 'Ver tu historial y ganancias', 
      color: 'bg-purple-500'
    }
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Tarjetas de menú */}
      <div className="grid grid-cols-1 gap-4">
        {menu.map(item => (
          <Link 
            key={item.to} 
            to={item.to}
            className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-lg hover:border-primary-300 transition-all active:scale-98"
          >
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 ${item.color} rounded-lg flex items-center justify-center shadow-md flex-shrink-0`}>
                <item.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{item.label}</h3>
                <p className="text-gray-500 text-sm mt-1">{item.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}