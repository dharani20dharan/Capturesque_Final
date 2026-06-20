import axios from "axios";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

// Ensure this URL points to your single, merged backend server
const API_BASE_URL = import.meta.env.VITE_AUTH_BASE_URL || "http://localhost:8087";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Registration Security Question / Answer
  const [securityQuestion, setSecurityQuestion] = useState("What was your first pet's name?");
  const [securityAnswer, setSecurityAnswer] = useState("");

  // View States: "login" | "register" | "forgot_email" | "forgot_reset"
  const [viewState, setViewState] = useState("login");

  // Reset Password Flow States
  const [resetEmail, setResetEmail] = useState("");
  const [resetQuestion, setResetQuestion] = useState("");
  const [resetAnswer, setResetAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [passwordFeedback, setPasswordFeedback] = useState("");
  const navigate = useNavigate();

  // Social SSO states
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [showMicrosoftModal, setShowMicrosoftModal] = useState(false);
  const [socialEmailInput, setSocialEmailInput] = useState("");
  const [socialMode, setSocialMode] = useState("select"); // "select" | "custom"
  const [microsoftStep, setMicrosoftStep] = useState(1); // 1: email, 2: password
  const [socialLoading, setSocialLoading] = useState(false);

  const handleSocialLogin = async (emailToUse, provider) => {
    setSocialLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/social-login`, {
        email: emailToUse,
        provider: provider
      });

      if (response.data.success) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("userEmail", response.data.user.email);
        localStorage.setItem("userRole", response.data.user.role);

        window.dispatchEvent(new Event('authChange'));
        
        // Simulating interactive transition
        setTimeout(() => {
          setSocialLoading(false);
          setShowGoogleModal(false);
          setShowMicrosoftModal(false);
          navigate("/gallery");
        }, 1200);
      } else {
        alert("Social Login failed: " + response.data.message);
        setSocialLoading(false);
      }
    } catch (error) {
      console.error("Social Login Error:", error);
      alert("Social Login failed: " + (error.response?.data?.message || "Server error"));
      setSocialLoading(false);
    }
  };

  const handlePasswordChange = (val) => {
    setPassword(val);
    if (val.length === 0) {
      setPasswordFeedback("");
      return;
    }
    const requirements = [];
    if (val.length < 8) requirements.push("at least 8 chars");
    if (!/\d/.test(val)) requirements.push("1 number");
    if (!/[!@#$%^&*()\-=_+[\]{};:'",.<>/?\\|]/.test(val)) requirements.push("1 special character");

    if (requirements.length > 0) {
      setPasswordFeedback(`Needs: ${requirements.join(", ")}`);
    } else {
      setPasswordFeedback("Password is secure ✓");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_BASE_URL}/login`, { email, password });

      if (response.data.success) {
        alert("Login successful");
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("userEmail", response.data.user.email);
        localStorage.setItem("userRole", response.data.user.role); 

        window.dispatchEvent(new Event('authChange'));
        navigate("/gallery");
      } else {
        alert("Login failed: " + response.data.message);
      }
    } catch (error) {
      console.error("Login Error:", error.response ? error.response.data : error.message);
      alert("Login failed: " + (error.response?.data?.message || "Server error"));
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_BASE_URL}/register`, {
        email,
        password,
        securityQuestion,
        securityAnswer,
      });

      if (response.data.success) {
        alert("Registration successful! Please login.");
        // Clear input states
        setEmail("");
        setPassword("");
        setSecurityAnswer("");
        setPasswordFeedback("");
        setViewState("login");
      } else {
        alert("Registration failed: " + response.data.message);
      }
    } catch (error) {
      console.error("Registration Error:", error.response ? error.response.data : error.message);
      alert("Registration failed: " + (error.response?.data?.message || "Server error"));
    }
  };

  const handleRequestQuestion = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/forgot-password`, { email: resetEmail });
      if (response.data.success) {
        setResetQuestion(response.data.question);
        setViewState("forgot_reset");
      }
    } catch (error) {
      console.error("Forgot Password Error:", error);
      alert("Error: " + (error.response?.data?.message || "Failed to fetch security question. Ensure email is correct."));
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      return alert("New passwords do not match!");
    }
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/reset-password`, {
        email: resetEmail,
        answer: resetAnswer,
        newPassword: newPassword
      });
      if (response.data.success) {
        alert(response.data.message);
        setResetEmail("");
        setResetQuestion("");
        setResetAnswer("");
        setNewPassword("");
        setConfirmNewPassword("");
        setViewState("login");
      }
    } catch (error) {
      console.error("Reset Password Error:", error);
      alert("Reset failed: " + (error.response?.data?.message || "Server error"));
    }
  };

  return (
    <div className="login-container">
      {viewState === "login" && (
        <form onSubmit={handleLogin}>
          <h2>LOGIN</h2>
          <div>
            <label>Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label>Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 12 }}>
            <span 
              onClick={() => setViewState("forgot_email")} 
              style={{ cursor: 'pointer', fontSize: '0.85rem', color: '#007bff', textDecoration: 'underline' }}
            >
              Forgot Password?
            </span>
          </div>
          <button type="submit">Login</button>
          
          <div className="sso-divider">
            <span>or continue with</span>
          </div>

          <div className="sso-buttons">
            <button type="button" className="sso-btn google-btn" onClick={() => { setShowGoogleModal(true); setSocialMode("select"); }}>
              <svg className="sso-icon" viewBox="0 0 24 24" width="18" height="18">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
            <button type="button" className="sso-btn microsoft-btn" onClick={() => { setShowMicrosoftModal(true); setMicrosoftStep(1); }}>
              <svg className="sso-icon" viewBox="0 0 23 23" width="18" height="18">
                <rect x="0" y="0" width="11" height="11" fill="#f25022"/>
                <rect x="12" y="0" width="11" height="11" fill="#7fba00"/>
                <rect x="0" y="12" width="11" height="11" fill="#00a4ef"/>
                <rect x="12" y="12" width="11" height="11" fill="#ffb900"/>
              </svg>
              Microsoft
            </button>
          </div>

          <div className="admin-demo-badge">
            <span className="admin-demo-icon">💡</span>
            <div className="admin-demo-text">
              <span className="admin-title">Admin Account Credentials</span>
              <span className="admin-details">Email: <code>dharani080905@gmail.com</code></span>
              <span className="admin-details">Password: <code>Admin@123</code></span>
              <span className="admin-details">Security Ans: <code>blue</code></span>
              <span className="admin-hint">Quick-login: click Google/Microsoft SSO and select the Admin profile!</span>
            </div>
          </div>

          <p>
            Don't have an account? <span onClick={() => { setViewState("register"); setEmail(""); setPassword(""); setPasswordFeedback(""); }}>Register here</span>
          </p>
        </form>
      )}

      {viewState === "register" && (
        <form onSubmit={handleRegister}>
          <h2>REGISTER</h2>
          <div>
            <label>Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label>Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              required
              autoComplete="new-password"
            />
            {passwordFeedback && (
              <span style={{ 
                fontSize: '0.8rem', 
                color: passwordFeedback.includes("secure") ? '#2ecc71' : '#e74c3c',
                display: 'block',
                marginTop: 4
              }}>
                {passwordFeedback}
              </span>
            )}
          </div>
          <div>
            <label>Security Question:</label>
            <select 
              value={securityQuestion} 
              onChange={(e) => setSecurityQuestion(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: '#222', color: '#fff' }}
            >
              <option>What was your first pet's name?</option>
              <option>What was the name of your first school?</option>
              <option>What city were you born in?</option>
              <option>What is your mother's maiden name?</option>
              <option>What is your favorite color?</option>
            </select>
          </div>
          <div style={{ marginTop: 12 }}>
            <label>Security Answer:</label>
            <input
              type="text"
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
              required
              placeholder="e.g. blue"
            />
          </div>
          <button type="submit" style={{ marginTop: 16 }}>Register</button>
          <p>
            Already have an account? <span onClick={() => { setViewState("login"); setEmail(""); setPassword(""); }}>Login here</span>
          </p>
        </form>
      )}

      {viewState === "forgot_email" && (
        <form onSubmit={handleRequestQuestion}>
          <h2>FORGOT PASSWORD</h2>
          <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: 16 }}>
            Enter your registered email to retrieve your security question.
          </p>
          <div>
            <label>Email Address:</label>
            <input
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
            />
          </div>
          <button type="submit" style={{ marginTop: 12 }}>Get Security Question</button>
          <p>
            Remembered password? <span onClick={() => setViewState("login")}>Login here</span>
          </p>
        </form>
      )}

      {viewState === "forgot_reset" && (
        <form onSubmit={handleResetPassword}>
          <h2>RESET PASSWORD</h2>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 4, marginBottom: 16 }}>
            <span style={{ fontSize: '0.85rem', opacity: 0.6, display: 'block', marginBottom: 4 }}>Security Question:</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{resetQuestion}</span>
          </div>
          <div>
            <label>Security Answer:</label>
            <input
              type="text"
              value={resetAnswer}
              onChange={(e) => setResetAnswer(e.target.value)}
              required
              placeholder="Case-insensitive answer"
            />
          </div>
          <div>
            <label>New Password:</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Confirm New Password:</label>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" style={{ marginTop: 12 }}>Reset Password</button>
          <p>
            Cancel reset? <span onClick={() => { setViewState("login"); setResetEmail(""); }}>Back to Login</span>
          </p>
        </form>
      )}

      {/* Google Modal Overlay */}
      {showGoogleModal && (
        <div className="social-overlay">
          <div className="google-modal slide-in-modal">
            <div className="google-modal-header">
              <svg viewBox="0 0 24 24" width="40" height="40" className="google-brand-logo">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <h3>Sign in with Google</h3>
              <p>to continue to <span className="app-brand-name">Capturesque</span></p>
            </div>

            {socialLoading ? (
              <div className="social-loading-container">
                <div className="google-spinner"></div>
                <p>Signing you in safely...</p>
              </div>
            ) : socialMode === "select" ? (
              <div className="google-modal-content">
                <div className="profile-accounts-list">
                  <div className="profile-account-item" onClick={() => handleSocialLogin("dharani080905@gmail.com", "google")}>
                    <div className="avatar-circle google-avatar">D</div>
                    <div className="profile-details">
                      <span className="profile-name">Dharanidharan</span>
                      <span className="profile-email">dharani080905@gmail.com</span>
                    </div>
                    <span className="profile-badge admin-badge">Admin</span>
                  </div>

                  <div className="profile-account-item" onClick={() => { setSocialMode("custom"); setSocialEmailInput(""); }}>
                    <div className="avatar-circle other-avatar">+</div>
                    <div className="profile-details">
                      <span className="profile-name" style={{ color: '#4285f4', fontWeight: 500 }}>Use another account</span>
                      <span className="profile-email">Sign in with a different Gmail</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="google-modal-custom">
                <div className="google-input-group">
                  <input
                    type="email"
                    placeholder="Email or phone"
                    value={socialEmailInput}
                    onChange={(e) => setSocialEmailInput(e.target.value)}
                    required
                    className="google-input"
                  />
                  <span className="google-input-bar"></span>
                </div>
                <div className="google-buttons-row">
                  <button className="google-cancel-btn" onClick={() => setSocialMode("select")}>Back</button>
                  <button 
                    className="google-next-btn" 
                    onClick={() => {
                      if (!socialEmailInput.includes("@")) {
                        alert("Please enter a valid email address");
                        return;
                      }
                      handleSocialLogin(socialEmailInput, "google");
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            
            <div className="google-modal-footer">
              <span className="close-link" onClick={() => { setShowGoogleModal(false); setSocialMode("select"); }}>Cancel</span>
              <div className="footer-links">
                <span>Help</span>
                <span>Privacy</span>
                <span>Terms</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Microsoft Modal Overlay */}
      {showMicrosoftModal && (
        <div className="social-overlay">
          <div className="microsoft-modal slide-in-modal">
            <div className="microsoft-modal-logo">
              <svg viewBox="0 0 23 23" width="36" height="36">
                <rect x="0" y="0" width="11" height="11" fill="#f25022"/>
                <rect x="12" y="0" width="11" height="11" fill="#7fba00"/>
                <rect x="0" y="12" width="11" height="11" fill="#00a4ef"/>
                <rect x="12" y="12" width="11" height="11" fill="#ffb900"/>
              </svg>
              <span className="ms-logo-text">Microsoft</span>
            </div>

            {socialLoading ? (
              <div className="social-loading-container">
                <div className="microsoft-spinner"></div>
                <p>Signing in...</p>
              </div>
            ) : microsoftStep === 1 ? (
              <div className="microsoft-content">
                <h3>Sign in</h3>
                <div className="ms-suggested-profiles">
                  <div className="ms-profile-item" onClick={() => handleSocialLogin("dharani080905@gmail.com", "microsoft")}>
                    <div className="avatar-circle microsoft-avatar">D</div>
                    <div className="profile-details">
                      <span className="profile-name">Dharanidharan (Admin)</span>
                      <span className="profile-email">dharani080905@gmail.com</span>
                    </div>
                  </div>
                </div>
                
                <div className="ms-divider-or">
                  <span>OR ENTER EMAIL</span>
                </div>

                <div className="ms-input-container">
                  <input
                    type="email"
                    placeholder="Email, phone, or Skype"
                    value={socialEmailInput}
                    onChange={(e) => setSocialEmailInput(e.target.value)}
                    className="ms-input"
                  />
                </div>
                
                <div className="ms-buttons-row">
                  <button className="ms-back-btn" onClick={() => setShowMicrosoftModal(false)}>Cancel</button>
                  <button 
                    className="ms-next-btn"
                    onClick={() => {
                      if (!socialEmailInput) {
                        setSocialEmailInput("dharani080905@gmail.com");
                      }
                      setMicrosoftStep(2);
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : (
              <div className="microsoft-content">
                <div className="ms-back-identity" onClick={() => setMicrosoftStep(1)}>
                  <span className="ms-back-arrow">←</span>
                  <span className="ms-back-email">{socialEmailInput || "dharani080905@gmail.com"}</span>
                </div>
                <h3>Enter password</h3>
                <div className="ms-input-container">
                  <input
                    type="password"
                    placeholder="Password"
                    defaultValue="••••••••"
                    className="ms-input"
                    readOnly
                  />
                </div>
                
                <p className="ms-keep-signed">
                  <input type="checkbox" id="keepSigned" defaultChecked />
                  <label htmlFor="keepSigned" style={{ display: 'inline', marginLeft: 6, color: '#333' }}>Keep me signed in</label>
                </p>

                <div className="ms-buttons-row">
                  <button className="ms-back-btn" onClick={() => setMicrosoftStep(1)}>Back</button>
                  <button 
                    className="ms-next-btn"
                    onClick={() => {
                      const emailToUse = socialEmailInput || "dharani080905@gmail.com";
                      if (!emailToUse.includes("@")) {
                        alert("Please enter a valid email address");
                        return;
                      }
                      handleSocialLogin(emailToUse, "microsoft");
                    }}
                  >
                    Sign in
                  </button>
                </div>
              </div>
            )}

            <div className="ms-modal-footer">
              <span>Terms of use</span>
              <span>Privacy & cookies</span>
              <span>...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login; 