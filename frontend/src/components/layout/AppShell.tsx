import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import './AppShell.css';

/**
 * Main layout for authenticated routes: Header on top, Sidebar on the
 * left, and the active child route rendered via <Outlet /> on the right.
 * Below o breakpoint mobile o Sidebar vira um drawer controlado por este
 * estado (aberto pelo botao de menu no Header).
 */
export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      <Header onMenuToggle={() => setMenuOpen((atual) => !atual)} />
      <div className="app-shell-body">
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        <main className="app-shell-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
