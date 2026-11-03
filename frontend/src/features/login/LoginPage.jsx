import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../../api/auth';
import { applyTheme, getStoredTheme } from '../../utils/theme';
import { HeroPanel } from './components/HeroPanel';
import { LoginPanel } from './components/LoginPanel';

export default function LoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    applyTheme(getStoredTheme());
    if (isAuthenticated()) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="login-root flex h-[100dvh] max-h-[100dvh] overflow-hidden">
      <LoginPanel />
      <HeroPanel />
    </div>
  );
}
