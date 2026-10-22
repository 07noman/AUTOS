import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Store,
  User,
  Phone,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import './Auth.css';

const MODULE_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  bakery: 'Bakery',
  mart: 'Mart & Grocery',
  retail: 'Retail Shop',
  clothing: 'Clothing',
  furniture: 'Furniture',
  bar: 'Cafe & Bar',
  'auto-parts': 'Business pos & store',
  auto_care: 'Business pos & store',
  general: 'General',
};

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);

  // Login Form State
  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
  });

  // Signup Form State
  const [signupData, setSignupData] = useState({
    businessName: '',
    storeCode: '',
    ownerName: '',
    email: '',
    password: '',
    phone: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const { login, registerStore } = useAuth();
  const navigate = useNavigate();

  const selectedModule = localStorage.getItem('genx:selectedModule');
  const businessName = selectedModule ? MODULE_LABELS[selectedModule] || selectedModule : null;

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSignupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSignupData((prev) => {
      const updated = { ...prev, [name]: value };
      // Auto-generate store code if user is typing business name
      if (name === 'businessName' && !prev.storeCode) {
        updated.storeCode = value.toLowerCase().replace(/[^a-z0-9]/g, '-');
      }
      return updated;
    });
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const redirectAfterAuth = () => {
    const current = localStorage.getItem('genx:selectedModule');
    if (current === 'auto-parts' || current === 'auto_care') {
      navigate('/auto-care');
    } else if (current) {
      navigate('/pos');
    } else {
      navigate('/select-module');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!loginData.email || !loginData.password) {
      setError('Please enter your email and password.');
      return;
    }

    try {
      setLoading(true);
      await login(loginData.email, loginData.password);
      redirectAfterAuth();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to sign in. Please check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const validateSignup = (): boolean => {
    const errors: Record<string, string> = {};
    if (!signupData.businessName.trim() || signupData.businessName.trim().length < 2) {
      errors.businessName = 'Business name is required (minimum 2 characters)';
    }
    if (!signupData.storeCode.trim()) {
      errors.storeCode = 'Store code is required (e.g. GENX001)';
    }
    if (!signupData.ownerName.trim() || signupData.ownerName.trim().length < 2) {
      errors.ownerName = 'Owner name is required (minimum 2 characters)';
    }
    if (!signupData.email.trim() || !/\S+@\S+\.\S+/.test(signupData.email)) {
      errors.email = 'Valid email address is required';
    }
    if (!signupData.password || signupData.password.length < 6) {
      errors.password = 'Password must contain at least 6 characters';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateSignup()) return;

    try {
      setLoading(true);
      await registerStore({
        storeName: signupData.businessName,
        storeCode: signupData.storeCode.trim().toUpperCase(),
        businessType: selectedModule || 'auto_care',
        email: signupData.email,
        password: signupData.password,
        name: signupData.ownerName,
        phone: signupData.phone || undefined,
      });
      redirectAfterAuth();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to create your business account.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* LEFT SIDE — POS Illustration & Branding */}
      <section className="auth-visual">
        <div className="visual-content">
          <div className="brand-logo-wrapper mb-6 flex justify-center">
            <img
              src="/assets/logo.svg"
              alt="GENX CLOUD POS Logo"
              className="h-12 max-w-[240px] object-contain"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src.endsWith('/assets/logo.svg')) {
                  target.src = '/assets/logo.png';
                } else if (target.src.endsWith('/assets/logo.png')) {
                  target.src = '/assets/logo.jpg';
                }
              }}
            />
          </div>


          <div className="pos-image-wrapper">
            <img
              src="/assets/pos-login-illustration.jpg"
              alt="GENX Cloud POS Business Management"
              className="pos-illustration"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src.endsWith('.jpg')) {
                  target.src = '/assets/pos-login-illustration.png';
                } else if (target.src.endsWith('.png')) {
                  target.src = '/assets/pos-login-illustration.svg';
                } else {
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent && !parent.querySelector('.pos-illustration-placeholder')) {
                    const box = document.createElement('div');
                    box.className = 'pos-illustration-placeholder p-8 border-2 border-dashed border-primary/30 rounded-xl bg-primary/5 text-primary text-center font-semibold text-sm w-full max-w-[400px] mx-auto';
                    box.innerHTML = '✨ Drop POS Illustration Here<br/><span class="text-xs text-text-muted font-normal mt-1 block">(/public/assets/pos-login-illustration.jpg / .png / .svg)</span>';
                    parent.appendChild(box);
                  }
                }
              }}
            />
          </div>


          <h1>
            Powering Smarter
            <br />
            Business Operations
          </h1>

          <p>
            Manage sales, inventory, customers, staff and business operations — online or offline,
            all from one powerful POS platform.
          </p>

          <div className="slider-dots">
            <span></span>
            <span className="active"></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </section>

      {/* RIGHT SIDE — Login / Register Forms */}
      <section className="auth-form-section">
        <div className="auth-form-container">
          {mode === 'login' ? (
            <>
              <div className="mobile-brand mb-4 flex justify-center">
                <img
                  src="/assets/logo.svg"
                  alt="GENX CLOUD POS Logo"
                  className="h-10 max-w-[200px] object-contain"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src.endsWith('/assets/logo.svg')) {
                      target.src = '/assets/logo.png';
                    }
                  }}
                />
              </div>


              <div className="form-heading">
                <h2>Welcome Back</h2>
                <p>Sign in to continue to your business dashboard.</p>
                {businessName && (
                  <div className="configuring-badge">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Configuring: {businessName} POS</span>
                  </div>
                )}
              </div>

              {error && <div className="auth-error">{error}</div>}

              <form onSubmit={handleLogin}>
                <div className="field">
                  <label htmlFor="login-email">Email (User ID)</label>
                  <div className="input-wrapper">
                    <Mail size={18} />
                    <input
                      id="login-email"
                      type="email"
                      name="email"
                      placeholder="Enter your email"
                      value={loginData.email}
                      onChange={handleLoginChange}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="field">
                  <div className="label-row">
                    <label htmlFor="login-password">Password</label>
                    <button
                      type="button"
                      className="forgot-link"
                      onClick={() => setError('Password reset instructions sent to your email.')}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="input-wrapper">
                    <LockKeyhole size={18} />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder="Enter your password"
                      value={loginData.password}
                      onChange={handleLoginChange}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button className="primary-button" type="submit" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>

              <div className="account-switch">
                <span>Don't have an account?</span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError('');
                  }}
                >
                  Create a Business Account
                </button>
              </div>

              <div className="pt-4 text-center mt-4">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('genx:selectedModule');
                    navigate('/select-module');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-primary transition-colors border-none bg-transparent cursor-pointer"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Choose a different business type
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                className="back-button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
              >
                <ArrowLeft size={17} />
                Back to Sign in
              </button>

              <div className="form-heading">
                <h2>Create Your Business Account</h2>
                <p>Set up your business and start managing everything from one place.</p>
              </div>

              {error && <div className="auth-error">{error}</div>}

              <form onSubmit={handleSignup}>
                <div className="field">
                  <label htmlFor="businessName">Store / Business Name *</label>
                  <div
                    className={`input-wrapper ${
                      validationErrors.businessName ? 'error-border' : ''
                    }`}
                  >
                    <Store size={18} />
                    <input
                      id="businessName"
                      name="businessName"
                      type="text"
                      placeholder="Enter your business name"
                      value={signupData.businessName}
                      onChange={handleSignupChange}
                      autoComplete="organization"
                    />
                  </div>
                  {validationErrors.businessName && (
                    <span className="field-error">{validationErrors.businessName}</span>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="storeCode">Store Code *</label>
                  <div
                    className={`input-wrapper ${validationErrors.storeCode ? 'error-border' : ''}`}
                  >
                    <Store size={18} />
                    <input
                      id="storeCode"
                      name="storeCode"
                      type="text"
                      placeholder="e.g. GENX001"
                      value={signupData.storeCode}
                      onChange={handleSignupChange}
                    />
                  </div>
                  {validationErrors.storeCode && (
                    <span className="field-error">{validationErrors.storeCode}</span>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="ownerName">Owner Name *</label>
                  <div
                    className={`input-wrapper ${validationErrors.ownerName ? 'error-border' : ''}`}
                  >
                    <User size={18} />
                    <input
                      id="ownerName"
                      name="ownerName"
                      type="text"
                      placeholder="Enter owner name"
                      value={signupData.ownerName}
                      onChange={handleSignupChange}
                      autoComplete="name"
                    />
                  </div>
                  {validationErrors.ownerName && (
                    <span className="field-error">{validationErrors.ownerName}</span>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="reg-email">Email (User ID) *</label>
                  <div
                    className={`input-wrapper ${validationErrors.email ? 'error-border' : ''}`}
                  >

                    <Mail size={18} />
                    <input
                      id="reg-email"
                      name="email"
                      type="email"
                      placeholder="Enter your email address"
                      value={signupData.email}
                      onChange={handleSignupChange}
                      autoComplete="email"
                    />
                  </div>
                  {validationErrors.email && (
                    <span className="field-error">{validationErrors.email}</span>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="reg-password">Password *</label>
                  <div
                    className={`input-wrapper ${validationErrors.password ? 'error-border' : ''}`}
                  >
                    <LockKeyhole size={18} />
                    <input
                      id="reg-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a secure password"
                      value={signupData.password}
                      onChange={handleSignupChange}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {validationErrors.password && (
                    <span className="field-error">{validationErrors.password}</span>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="phone">Phone (optional)</label>
                  <div className="input-wrapper">
                    <Phone size={18} />
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="+92 3XX XXXXXXX"
                      value={signupData.phone}
                      onChange={handleSignupChange}
                      autoComplete="tel"
                    />
                  </div>
                </div>

                <button className="primary-button" type="submit" disabled={loading}>
                  {loading ? 'Creating Account...' : 'Create Business Account'}
                </button>
              </form>

              <div className="account-switch">
                <span>Already have an account?</span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                >
                  Sign In
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default LoginPage;
