import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, HardDrive, Settings, FileText, ArrowLeft, Gamepad2 } from 'lucide-react';
import clsx from 'clsx';

const adminNav = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { path: '/admin/users', icon: Users, label: 'Users' },
  { path: '/admin/roms', icon: HardDrive, label: 'ROMs' },
  { path: '/admin/settings', icon: Settings, label: 'Settings' },
  { path: '/admin/audit', icon: FileText, label: 'Audit Log' },
];

export default function AdminLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-950">
      <aside className="fixed left-0 top-0 z-40 w-64 h-screen bg-gray-900 border-r border-gray-800">
        <div className="flex items-center gap-3 h-16 px-6 border-b border-gray-800">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Gamepad2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold text-white">EmuVerse</span>
            <span className="block text-xs text-amber-400">Admin Panel</span>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {adminNav.map((item) => {
            const isActive = item.exact 
              ? location.pathname === item.path 
              : location.pathname.startsWith(item.path);
            return (
              <Link key={item.path} to={item.path} className={clsx(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
                isActive ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}>
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
          <Link to="/" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-gray-800 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to App</span>
          </Link>
        </div>
      </aside>

      <main className="ml-64 min-h-screen">
        <header className="h-16 bg-gray-900/80 backdrop-blur border-b border-gray-800 flex items-center px-6">
          <h1 className="text-xl font-semibold text-white">Administration</h1>
        </header>
        <div className="p-6"><Outlet /></div>
      </main>
    </div>
  );
}
