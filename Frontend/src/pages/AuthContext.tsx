import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

/* -------------------- TYPES -------------------- */

interface User {
  id: string;
  email: string;
  role: "operator" | "manager" | "project_manager";
}

interface AuthContextType {
  user: User | null;
  loading: boolean;

  // 🔥 NEW
  loginTime: Date | null;

  setUser: (user: User | null) => void;
  setLoginTime: (time: Date | null) => void;
}

/* -------------------- CONTEXT -------------------- */

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  loginTime: null,
  setUser: () => {},
  setLoginTime: () => {},
});

/* -------------------- PROVIDER -------------------- */

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loginTime, setLoginTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("token");

  useEffect(() => {
    const getUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/auth/me`,
          {
            headers: { Authorization: `Bearer ${token}` },
            withCredentials: true,
          }
        );

        setUser(res.data);

        // ❗ DO NOT set loginTime here
        // This effect runs on refresh / app mount
      } catch (error) {
        setUser(null);
        setLoginTime(null);
      } finally {
        setLoading(false);
      }
    };

    getUser();
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginTime,
        setUser,
        setLoginTime,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/* -------------------- HOOK -------------------- */

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
