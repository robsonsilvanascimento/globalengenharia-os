import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import './AppShell.css';

/**
 * Main layout for authenticated routes: Header on top, Sidebar on the
 * left, and the active child route rendered via <Outlet /> on the right.
 */
export function AppShell() {
  return (
    <div className="app-shell">
      <Header />
      <div className="app-shell-body">
        <Sidebar />
        <main className="app-shell-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
