import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import { AuthProvider } from './context/AuthContext';
import AppRouter from './components/routing/AppRouter'; // <-- Import new router

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <div className="container">
          <AppRouter /> {/* <-- Use new router */}
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;