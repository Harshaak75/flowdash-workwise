import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import axios from "axios";
import { AlertCircle, Loader2 } from "lucide-react";
import { ThreeDot } from "react-loading-indicators";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// --- SKELETON LOADER COMPONENT ---
const SkeletonHrmDashboard = () => (
  // This div mimics the main content area for the iframe
  <div className="w-full h-[calc(100vh-4rem)] flex items-center justify-center p-0 m-0 animate-pulse">
    <div className="w-11/12 h-[90%] bg-gray-100 rounded-lg shadow-xl border-4 border-dashed border-gray-300 flex flex-col items-center justify-center space-y-4">
      <Loader2 className="h-12 w-12 text-[#0000cc] animate-spin" />
      <h3 className="text-xl font-semibold text-gray-700">
        Loading External Dashboard...
      </h3>
      <div className="h-4 w-64 bg-gray-200 rounded"></div>
      <div className="h-3 w-48 bg-gray-100 rounded"></div>
    </div>
  </div>
);
// --- END SKELETON LOADER COMPONENT ---

export default function HrmDashboard() {
  const [hrmUrl, setHrmUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const tenant_code = import.meta.env.VITE_TENANT_CODE;
  const backend_url = import.meta.env.VITE_API_BASE_URL;
  const [role, setRole] = useState(null);

  const token = localStorage.getItem("token");

  useEffect(() => {
    const loadHrmUrl = async () => {
      try {
        // Simulate network delay to show the skeleton loader
        await new Promise((resolve) => setTimeout(resolve, 800));

        const res = await fetch(
          `${backend_url}/auth/go-to-hrm`,
          {
            method: "GET",
            credentials: "include", // 🔥 must include cookies for auth
          }
        );

        const data = await res.json();

        if (res.ok && data.redirectUrl) {
          setHrmUrl(data.redirectUrl);
        } else if (data.error === "Session expired, login again.") {
          // Use navigate only after state cleanup to ensure smooth transition
          setTimeout(() => navigate("/login"), 0);
          setError("Session expired. Redirecting to login...");
        } else if (!res.ok) {
          setError(data.error || "Failed to retrieve redirect URL.");
        } else {
          setError("No redirect URL provided.");
        }
      } catch (err: any) {
        console.error("Failed to load HRM URL:", err);
        setError(err.message || "Network error occurred.");
      } finally {
        setLoading(false);
      }
    };

    loadHrmUrl();
  }, []);

  // Renders the layout and content area
  return (
    <Layout>
      <div className="w-full h-[calc(100vh-4rem)] flex items-center justify-center p-0 m-0">
        {loading ? (
          // Renders the Skeleton when loading is true
          <SkeletonHrmDashboard />
        ) : error ? (
          <div className="flex flex-col items-center justify-center text-red-600">
            <AlertCircle className="h-10 w-10 text-red-600" />
            <p className="font-bold text-lg mt-2">
              HRM Dashboard Failed to Load
            </p>
            <p className="text-sm text-center mt-1 max-w-md">{error}</p>
          </div>
        ) : hrmUrl ? (
          <iframe
            src={hrmUrl}
            title="HRM Dashboard"
            className="w-full h-full border-0"
            style={{
              display: "block",
            }}
            allow="fullscreen *; geolocation *"
          />
        ) : (
          <div className="text-center text-gray-500 p-10">
            <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm">No HRM Dashboard URL available.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
