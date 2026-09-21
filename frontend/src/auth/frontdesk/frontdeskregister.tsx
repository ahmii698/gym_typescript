import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { UserPlus, User, Mail, Phone, Lock, Eye, EyeOff } from "lucide-react";
import bannerImg from "../../assets/gym-banner1.png";
import logoImg from "../../assets/logo.png";
import { API_URL } from "../../../config";
import "./frontdeskregister.css";

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

const FrontdeskRegister = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormData]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
    if (serverError) setServerError("");
  };

  const validate = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.fullName.trim()) newErrors.fullName = "Full name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Enter a valid email";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!/^03\d{2}-?\d{7}$/.test(formData.phone.replace(/\s/g, ""))) {
      newErrors.phone = "Enter a valid phone number";
    }
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }
    if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setServerError("");
    try {
      await axios.post(
        `${API_URL}/frontdesk/register`,
        {
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          password_confirmation: formData.confirmPassword,
        },
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      alert("Front desk account created successfully");
      navigate("/admin/dashboard");
    } catch (err: any) {
      console.error(err);

      if (err.response?.status === 401 || err.response?.status === 403) {
        setServerError("You are not allowed to do this. Please login as admin.");
      } else if (err.response?.status === 422) {
        // Laravel validation errors (e.g. email already taken)
        const apiErrors = err.response.data.errors || {};
        const mapped: Partial<FormData> = {};
        if (apiErrors.fullName) mapped.fullName = apiErrors.fullName[0];
        if (apiErrors.email) mapped.email = apiErrors.email[0];
        if (apiErrors.phone) mapped.phone = apiErrors.phone[0];
        if (apiErrors.password) mapped.password = apiErrors.password[0];
        setErrors(mapped);
      } else {
        setServerError(
          err.response?.data?.message || "Something went wrong. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="frontdesk-register-wrapper">
      <div
        className="frontdesk-register-banner"
        style={{ backgroundImage: `url(${bannerImg})` }}
      />

      <div className="frontdesk-register-formside">
        <div className="frontdesk-register-card">
          <div className="frontdesk-register-logo">
            <img src={logoImg} alt="Gym Logo" />
          </div>

          <div className="frontdesk-register-header">
            <div className="frontdesk-register-icon">
              <UserPlus size={26} strokeWidth={2} />
            </div>
            <h1 className="frontdesk-register-title">Front Desk Registration</h1>
            <p className="frontdesk-register-subtitle">
              Fill in the details to create a new front desk account.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="frontdesk-form-group">
              <label htmlFor="fullName">
                Full Name <span className="required">*</span>
              </label>
              <div className={`frontdesk-input-box ${errors.fullName ? "error" : ""}`}>
                <User size={18} className="input-icon" />
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  placeholder="Enter full name"
                  value={formData.fullName}
                  onChange={handleChange}
                  autoComplete="name"
                />
              </div>
              {errors.fullName && <span className="error-text">{errors.fullName}</span>}
            </div>

            <div className="frontdesk-form-group">
              <label htmlFor="email">
                Email Address <span className="required">*</span>
              </label>
              <div className={`frontdesk-input-box ${errors.email ? "error" : ""}`}>
                <Mail size={18} className="input-icon" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                />
              </div>
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>

            <div className="frontdesk-form-group">
              <label htmlFor="phone">
                Phone Number <span className="required">*</span>
              </label>
              <div className={`frontdesk-input-box ${errors.phone ? "error" : ""}`}>
                <Phone size={18} className="input-icon" />
                <input
                  type="text"
                  id="phone"
                  name="phone"
                  placeholder="03XX-XXXXXXX"
                  value={formData.phone}
                  onChange={handleChange}
                  autoComplete="tel"
                />
              </div>
              {errors.phone && <span className="error-text">{errors.phone}</span>}
            </div>

            <div className="frontdesk-form-group">
              <label htmlFor="password">
                Password <span className="required">*</span>
              </label>
              <div className={`frontdesk-input-box ${errors.password ? "error" : ""}`}>
                <Lock size={18} className="input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  placeholder="Enter password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="toggle-visibility"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <span className="error-text">{errors.password}</span>}
            </div>

            <div className="frontdesk-form-group">
              <label htmlFor="confirmPassword">
                Confirm Password <span className="required">*</span>
              </label>
              <div className={`frontdesk-input-box ${errors.confirmPassword ? "error" : ""}`}>
                <Lock size={18} className="input-icon" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="toggle-visibility"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <span className="error-text">{errors.confirmPassword}</span>
              )}
            </div>

            {serverError && <span className="error-text">{serverError}</span>}

            <button type="submit" className="frontdesk-register-btn" disabled={loading}>
              <UserPlus size={18} />
              {loading ? "Registering..." : "Register"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FrontdeskRegister;