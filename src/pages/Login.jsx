import axios from "axios";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate for navigation
import "./Login.css"; // Import CSS for styling

const API_BASE_URL = "http://localhost:5000"; // Ensure correct backend URL

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true); // Track whether user is on login or registration form
  const navigate = useNavigate(); // React Router navigation hook

  // Reset form fields when switching between Login/Register
  const switchForm = () => {
    setEmail("");
    setPassword("");
    setIsLogin(!isLogin);
  };

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post(`${API_BASE_URL}/login`, { email, password });


      if (response.data.success) {
        alert("Login successful");
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("userEmail", response.data.user.email); // Store email

        navigate("/gallery"); // Navigate to dashboard using React Router
      } else {
        alert("Login failed: " + response.data.message);
      }
    } catch (error) {
      console.error("Login Error:", error.response ? error.response.data : error.message);
      alert("Login failed: " + (error.response?.data?.message || "Server error"));
    }
  };

  // Handle Registration
  const handleRegister = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post(`${API_BASE_URL}/register`, { email, password });


      if (response.data.success) {
        alert("Registration successful! Please login.");
        switchForm(); // Switch to login form after registration
      } else {
        alert("Registration failed: " + response.data.message);
      }
    } catch (error) {
      console.error("Registration Error:", error.response ? error.response.data : error.message);
      alert("Registration failed: " + (error.response?.data?.message || "Server error"));
    }
  };

  return (
    <div className="login-container">
      {isLogin ? (
        <form onSubmit={handleLogin}>
          <h2>LOGIN</h2>
          <div>
            <label>Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit">Login</button>
          <p>
            Don't have an account? <span onClick={switchForm}>Register here</span>
          </p>
        </form>
      ) : (
        <form onSubmit={handleRegister}>
          <h2>REGISTER</h2>
          <div>
            <label>Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit">Register</button>
          <p>
            Already have an account? <span onClick={switchForm}>Login here</span>
          </p>
        </form>
      )}
    </div>
  );
};

export default Login;