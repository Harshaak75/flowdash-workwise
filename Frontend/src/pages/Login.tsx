import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Users, BarChart3, Lock, LogIn, Loader2 } from "lucide-react"; // Added Lock, LogIn, Loader2
import { useAuth } from "./AuthContext";

// --- Colors based on inspiration ---
const COLOR_PRIMARY = "#0000cc";
const COLOR_ACCENT_ICON = "text-red-500";

export default function Login() {
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantCode, setTenantCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setUser, setLoginTime } = useAuth();

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter email",
        variant: "destructive",
      });
      return;
    }
    else if(!password){
      toast({
        title: "Error",
        description: "Please enter password",
        variant: "destructive",
      });
      return;
    }
    else if(!tenantCode){
      toast({
        title: "Error",
        description: "Please enter tenant code",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, tenantCode }),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Login failed");
      }

      // Store JWT and role in localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("userRole", data.role);
      localStorage.setItem("userEmail", data.email);

      toast({
        title: "Login Successful",
        description: `Welcome back, ${data.email}!`,
      });

      const loginTime = new Date();

      setUser({
      id: data.userId,
      email: data.email,
      role: data.role.toLowerCase(),
    });
    setLoginTime(loginTime);

    

      // Redirect to dashboard
      navigate(`/${data.role.toLowerCase()}`);
    } catch (err: any) {
      toast({
        title: "Login Failed",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // const roleCards = [
  //   // Operator: Use deep blue for icon when not selected
  //   { role: "operator" as const, title: "Operator", icon: Users, iconColor: COLOR_ACCENT_ICON  },
  //   // Manager: Use red for icon when not selected (as an accent)
  //   { role: "manager" as const, title: "Project Manager", icon: BarChart3, iconColor: COLOR_ACCENT_ICON },
  // ];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card 
          className="shadow-2xl border-t-4 rounded-xl"
          style={{ borderTopColor: COLOR_PRIMARY }}
        >
          <CardHeader className="text-center space-y-2">
            <div className="mb-4">
              {/* Logo/Branding */}
              <div className="flex justify-center items-center gap-2 mb-2">
                <img className="w-[12rem]" src="https://i0.wp.com/dotspeaks.com/wp-content/uploads/2025/07/Dotspeaks-logo.png?fit=2560%2C591&ssl=1" alt="" />
              </div>
            </div>
            <CardTitle className="text-2xl font-semibold" style={{ color: COLOR_PRIMARY }}>
              Sign In to Your Account
            </CardTitle>
            {/* <CardDescription className="text-gray-500">
              Select your role to access the correct dashboard.
            </CardDescription> */}
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
              {/* <div className="space-y-3">
                <Label className="text-gray-700">Your Role</Label>
                <div className="grid grid-cols-2 gap-3">
                  {roleCards.map((card) => {
                    const Icon = card.icon;
                    const isSelected = role === card.role;
                    return (
                      <div
                        key={card.role}
                        className={`p-4 border rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 shadow-sm ${
                          isSelected
                            ? "border-[#0000cc] text-white font-semibold"
                            : "hover:bg-gray-100 border-gray-300 text-gray-700"
                        }`}
                        // Apply custom primary color background when selected
                        style={isSelected ? { backgroundColor: COLOR_PRIMARY } : {}}
                        onClick={() => setRole(card.role)}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`h-5 w-5 ${isSelected ? COLOR_ACCENT_ICON : card.iconColor}`} />
                          <span>{card.title}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div> */}

              <div className="space-y-2">
                <Label htmlFor="tenantCode" className="text-gray-700">Tenat Code</Label>
                <Input
                  id="tenantCode"
                  type="text"
                  placeholder="Enter Tenant Code"
                  value={tenantCode}
                  onChange={(e) => setTenantCode(e.target.value)}
                  autoComplete="email"
                  className="focus:border-[#0000cc] border-gray-30o"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="focus:border-[#0000cc] border-gray-30o"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="focus:border-[#0000cc] border-gray-300"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 gap-2 text-lg font-semibold shadow-md" 
                style={{ backgroundColor: COLOR_PRIMARY }}
                // Tailwind class for hover effect
                size="lg" 
                disabled={loading}
              >
                {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin text-red-500" /> Logging in...</>
                ) : (
                    <><LogIn className="h-5 w-5 text-red-500" /> Login</>
                )}
              </Button>

            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}