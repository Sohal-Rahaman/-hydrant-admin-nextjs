'use client';

import React, { ReactNode, useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { FiPhone, FiShield, FiLock, FiArrowRight, FiCheckCircle } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { setupRecaptcha, sendOTP, SUPERADMIN_PHONES } from '@/lib/firebase';
import { RecaptchaVerifier } from 'firebase/auth';

const LoginContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  color: white;
  text-align: center;
  padding: 20px;
`;

const LoginForm = styled.form`
  background: rgba(255, 255, 255, 0.05);
  padding: 40px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  width: 100%;
  max-width: 420px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
`;

const FormTitle = styled.h1`
  font-size: 1.8rem;
  font-weight: 800;
  margin-bottom: 8px;
  background: linear-gradient(to right, #60a5fa, #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
`;

const SubTitle = styled.p`
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 32px;
  font-size: 0.95rem;
`;

const FormGroup = styled.div`
  margin-bottom: 24px;
  text-align: left;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const InputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const InputIcon = styled.div`
  position: absolute;
  left: 16px;
  color: rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
`;

const Input = styled.input`
  width: 100%;
  padding: 14px 16px 14px 44px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  color: white;
  font-size: 1rem;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    background: rgba(255, 255, 255, 0.1);
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
  }

  &::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }
`;

const SubmitButton = styled.button`
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(to right, #2563eb, #7c3aed);
  color: white;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 8px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px -5px rgba(37, 99, 235, 0.4);
    filter: brightness(1.1);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const ErrorBox = styled.div`
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #f87171;
  padding: 12px;
  border-radius: 12px;
  margin-bottom: 24px;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const StatusBadge = styled.div<{ $active?: boolean }>`
  font-size: 0.75rem;
  padding: 4px 10px;
  border-radius: 99px;
  background: ${props => props.$active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)'};
  color: ${props => props.$active ? '#4ade80' : 'rgba(255, 255, 255, 0.4)'};
  border: 1px solid ${props => props.$active ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)'};
  margin-bottom: 24px;
  display: inline-block;
`;

const BackLink = styled.button`
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.85rem;
  margin-top: 20px;
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.2s ease;

  &:hover {
    color: #60a5fa;
  }
`;

const DevHelpBox = styled.div`
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  color: #93c5fd;
  padding: 16px;
  border-radius: 12px;
  margin-top: 24px;
  font-size: 0.8rem;
  text-align: left;
  line-height: 1.5;

  strong {
    color: white;
    display: block;
    margin-bottom: 4px;
  }

  code {
    background: rgba(0, 0, 0, 0.3);
    padding: 2px 4px;
    border-radius: 4px;
    font-family: monospace;
  }
`;

const AdminRoute: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, isAdmin, loading, signOut, checkAdminPrivileges, confirmationResult, setConfirmationResult } = useAuth();
  
  const [phone, setPhone] = useState('+91');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  // Function to initialize reCAPTCHA on-demand
  const initRecaptcha = async () => {
    if (recaptchaRef.current) {
      try { recaptchaRef.current.clear(); } catch (e) {}
    }
    const verifier = setupRecaptcha('recaptcha-container');
    recaptchaRef.current = verifier;
    await verifier.render();
    return verifier;
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (recaptchaRef.current) {
        try { recaptchaRef.current.clear(); } catch (e) {}
      }
    };
  }, []);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic format check (must start with +91)
    if (!phone.startsWith('+91') || phone.length < 13) {
      setError('Please enter a valid phone number with +91 prefix (e.g., +917908013185)');
      return;
    }

    // Normalize input for whitelist check (strip everything except + and digits)
    const normalizedPhone = phone.replace(/[^\d+]/g, '');

    // WHITELIST CHECK: Only allow superadmins to trigger OTP
    if (!SUPERADMIN_PHONES.includes(normalizedPhone)) {
      setError(`Access Denied: ${normalizedPhone} is not in the superadmin whitelist.`);
      return;
    }

    setIsActionLoading(true);
    try {
      // Initialize or get fresh verifier
      const verifier = await initRecaptcha();
      
      const result = await sendOTP(phone, verifier);
      setConfirmationResult(result);
      setStep('otp');
    } catch (err: unknown) {
      console.error('OTP Send Error:', err);
      let msg = err instanceof Error ? err.message : 'Failed to send OTP. Please try again.';
      
      // Specifically handle invalid-app-credential with advice
      if (msg.includes('auth/invalid-app-credential')) {
        msg = 'Credential Error: Please ensure localhost is white-listed in Firebase Console (Auth > Settings > Authorized Domains).';
        // Reset reCAPTCHA on this specific error
        if (recaptchaRef.current) {
          try { recaptchaRef.current.clear(); } catch (e) {}
          recaptchaRef.current = null;
        }
      }
      
      setError(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    
    setError(null);
    setIsActionLoading(true);
    
    try {
      const userCredential = await confirmationResult.confirm(otp);
      // Wait for AuthContext to detect change and check admin status
      await checkAdminPrivileges(userCredential.user);
    } catch (err: unknown) {
      console.error('OTP Verify Error:', err);
      setError('Invalid OTP code. Please check and try again.');
    } finally {
      setIsActionLoading(false);
    }
  };

  if (loading) {
    return (
      <LoginContainer>
        <div style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.7)' }}>
          <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginRight: 10 }}>💧</span>
          Verifying session...
        </div>
      </LoginContainer>
    );
  }

  // LOGGED IN BUT NOT ADMIN
  if (currentUser && !isAdmin) {
    return (
      <LoginContainer>
        <LoginForm as="div">
          <FormTitle>🔒 Superadmin Access Only</FormTitle>
          <SubTitle>The account <strong>{currentUser.phoneNumber}</strong> is not recognized as a Superadmin.</SubTitle>
          
          <ErrorBox>
            <FiShield size={20} />
            This is a restricted dashboard. Unauthorized access is blocked.
          </ErrorBox>

          <SubmitButton 
            onClick={async () => {
              await signOut();
              setConfirmationResult(null);
              setStep('phone');
              setError(null);
            }}
          >
            Switch Account
          </SubmitButton>
        </LoginForm>
      </LoginContainer>
    );
  }

  // NOT LOGGED IN
  if (!currentUser) {
    return (
      <LoginContainer>
        <LoginForm onSubmit={step === 'phone' ? handleSendOTP : handleVerifyOTP}>
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: '3rem' }}>💎</span>
          </div>
          <FormTitle>Hydrant OS</FormTitle>
          <SubTitle>Superadmin Console Authentication</SubTitle>

          <StatusBadge $active={step === 'otp'}>
            {step === 'phone' ? 'Waiting for credentials' : 'OTP Sent Successfully'}
          </StatusBadge>

          {error && (
            <ErrorBox>
              <FiShield size={18} />
              {error}
            </ErrorBox>
          )}

          {step === 'phone' && (
            <FormGroup>
              <Label htmlFor="phone">
                <FiPhone /> Superadmin Phone Number
              </Label>
              <InputWrapper>
                <InputIcon><FiPhone /></InputIcon>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+91XXXXXXXXXX"
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith('+91') || val === '') {
                      setPhone(val === '' ? '+91' : val);
                    }
                  }}
                  required
                />
              </InputWrapper>
            </FormGroup>
          )}

          {/* reCAPTCHA container - kept in DOM to avoid Firebase SDK crashes during step transitions */}
          <div 
            id="recaptcha-container" 
            style={{ 
              marginBottom: '20px', 
              display: step === 'phone' ? 'flex' : 'none', 
              justifyContent: 'center',
              minHeight: '78px' 
            }}
          ></div>

          {step === 'otp' && (
            <FormGroup>
              <Label htmlFor="otp">
                <FiLock /> Enter 6-Digit Verification Code
              </Label>
              <InputWrapper>
                <InputIcon><FiShield /></InputIcon>
                <Input
                  id="otp"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                />
              </InputWrapper>
            </FormGroup>
          )}

          <SubmitButton type="submit" disabled={isActionLoading}>
            {isActionLoading ? 'Processing...' : (
              step === 'phone' ? (
                <>Send Secure OTP <FiArrowRight /></>
              ) : (
                <>Verify & Open Dashboard <FiCheckCircle /></>
              )
            )}
          </SubmitButton>

          {step === 'otp' && (
            <BackLink 
              type="button" 
              onClick={() => {
                setStep('phone');
                setConfirmationResult(null);
                setError(null);
              }}
            >
              Change Phone Number
            </BackLink>
          )}

          {error?.includes('auth/invalid-app-credential') && (
            <DevHelpBox>
              <strong>🛠️ Development Troubleshooting</strong>
              To bypass SMS errors on localhost:
              1. Open <code>Firebase Console</code>
              2. Go to <code>Auth › Settings › Test Phone Numbers</code>
              3. Add <code>+917908013185</code> with code <code>123456</code>
              4. This allows instant login without SMS or reCAPTCHA issues.
            </DevHelpBox>
          )}
        </LoginForm>
      </LoginContainer>
    );
  }

  // AUTHORIZED
  return <>{children}</>;
};

export default AdminRoute;