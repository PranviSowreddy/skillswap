import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext'; // <-- 1. Import
import AppRouter from './components/routing/AppRouter';

function App() {
  return (
    <AuthProvider>
      <SocketProvider> {/* <-- 2. Wrap the Router */}
        <Router>
          <Navbar />
          <div className="container">
            <AppRouter />
          </div>
        </Router>
      </SocketProvider> {/* <-- 3. Close wrapper */}
    </AuthProvider>
  );
}

export default App;