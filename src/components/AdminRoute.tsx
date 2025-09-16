'use client';

import React, { ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import styled from 'styled-components';
import { FiEye, FiEyeOff, FiMail, FiLock } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%);
  color: white;
  font-size: 1.5rem;
`;

const LoginContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%);
  color: white;
  text-align: center;
`;

const LoginButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 15px 30px;
  border-radius: 10px;
  font-size: 1.1rem;
  cursor: pointer;
  margin-top: 20px;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  max-width: 300px;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const LoginForm = styled.form`
  background: rgba(255, 255, 255, 0.1);
  padding: 30px;
  border-radius: 15px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  width: 100%;
  max-width: 400px;
  margin: 20px;
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
  position: relative;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: white;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 15px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 1rem;
  transition: all 0.3s ease;

  &::placeholder {
    color: rgba(255, 255, 255, 0.7);
  }

  &:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.6);
    background: rgba(255, 255, 255, 0.15);
  }
`;

const PasswordContainer = styled.div`
  position: relative;
`;

const PasswordToggle = styled.button`
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 1.2rem;
  transition: color 0.3s ease;

  &:hover {
    color: white;
  }
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  margin: 25px 0;
  color: rgba(255, 255, 255, 0.7);
  
  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.3);
  }
  
  span {
    padding: 0 15px;
    font-size: 0.9rem;
  }
`;

const ErrorMessage = styled.div`
  background: rgba(220, 53, 69, 0.2);
  border: 1px solid rgba(220, 53, 69, 0.5);
  color: #ff6b6b;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 0.9rem;
`;

interface AdminRouteProps {
  children: ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { currentUser, isAdmin, loading, signIn, signInWithEmailPassword } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('sohalrahaman007@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setError('');

    try {
      await signInWithEmailPassword(email, password);
    } catch (error: unknown) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Login failed. Please check your credentials.';
      setError(errorMessage);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoginLoading(true);
    setError('');

    try {
      await signIn();
    } catch (error: unknown) {
      console.error('Google login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Google login failed.';
      setError(errorMessage);
    } finally {
      setLoginLoading(false);
    }
  };

  if (loading) {
    return (
      <LoadingContainer>
        <div>Loading...</div>
      </LoadingContainer>
    );
  }

  if (!currentUser) {
    return (
      <LoginContainer>
        <h1>Hydrant Admin Dashboard</h1>
        <p>Please sign in with your admin account to continue</p>
        
        <LoginForm onSubmit={handleEmailLogin}>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          
          <FormGroup>
            <Label>
              <FiMail />
              Email Address
            </Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </FormGroup>

          <FormGroup>
            <Label>
              <FiLock />
              Password
            </Label>
            <PasswordContainer>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
              <PasswordToggle
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </PasswordToggle>
            </PasswordContainer>
          </FormGroup>

          <LoginButton type="submit" disabled={loginLoading}>
            {loginLoading ? 'Signing in...' : 'Sign in with Email'}
          </LoginButton>

          <Divider>
            <span>or</span>
          </Divider>

          <LoginButton type="button" onClick={handleGoogleLogin} disabled={loginLoading}>
            🚀 Sign in with Google
          </LoginButton>
        </LoginForm>
      </LoginContainer>
    );
  }

  if (!isAdmin) {
    return (
      <LoginContainer>
        <h1>Access Denied</h1>
        <p>You don&apos;t have admin privileges to access this dashboard.</p>
        <p>Please contact the system administrator.</p>
      </LoginContainer>
    );
  }

  return <>{children}</>;
};

export default AdminRoute;