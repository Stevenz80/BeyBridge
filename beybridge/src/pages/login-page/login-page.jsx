import React, { useState } from 'react';
import './login-page.css';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (event) => {
    event.preventDefault();
    console.log('Logging in with', { email, password });
    // Add login logic here (e.g., API call)
  };

  return (
    <div className="login-container">
      <div className="logo-container">
        <img
          src="/BeyBridge Logo No Background.jpg.png"
          alt="BeyBridge Logo"
          className="logo"
        />
      </div>
      <form className="login-form" onSubmit={handleLogin}>
        <h1 className="login-title">Welcome to BeyBridge</h1>
        <p className="login-subtitle">Explore Beirut, One Service at a Time</p>

        <label htmlFor="email" className="login-label">
          Email:
        </label>
        <input
          type="email"
          id="email"
          className="login-input"
          placeholder="Enter your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="password" className="login-label">
          Password:
        </label>
        <input
          type="password"
          id="password"
          className="login-input"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div className="login-options">
          <a href="/forgot-password" className="forgot-password">
            Forgot Password?
          </a>
        </div>

        <button type="submit" className="login-button">
          Login
        </button>

        <p className="register-text">
          Don't have an account?{' '}
          <a href="/register" className="register-link">
            Register Now
          </a>
        </p>
      </form>
    </div>
  );
}

export default LoginPage;
