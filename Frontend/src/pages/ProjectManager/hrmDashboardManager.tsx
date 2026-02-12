import { Layout } from "@/components/Layout";
import { AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HRMLoader } from "@/components/HRMLoader"; // Import the new loader

export default function HrmManagerDashboard() {
  const [hrmUrl, setHrmUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const backend_url = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    const loadHrmUrl = async () => {
      try {
        const res = await fetch(
          `${backend_url}/auth/go-to-hrm`,
          {
            method: "GET",
            credentials: "include", // 🔥 must include cookies for auth
          }
        );

        const data = await res.json();
        console.log("the data", data);

        if (res.ok && data.redirectUrl) {
          setHrmUrl(data.redirectUrl);
          // NOTE: We do NOT set isLoading(false) here. 
          // We wait for the iframe onLoad event.
        } else if (data.error === "Session expired, login again.") {
          setTimeout(() => navigate("/login"), 0);
          setError("Session expired. Redirecting to login...");
          setIsLoading(false);
        } else if (!res.ok) {
          setError(data.error || "Failed to retrieve redirect URL.");
          setIsLoading(false);
        } else {
          setError("No redirect URL provided.");
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error("Failed to load HRM URL:", err);
        setError(err.message || "Network error occurred.");
        setIsLoading(false);
      }
    };

    loadHrmUrl();
  }, [backend_url, navigate]);

  return (
    <Layout>
      <div className="w-full h-[calc(100vh-4rem)] relative bg-gray-50 flex flex-col">

        {/* 1. Loading State (Covers fetching + iframe loading) */}
        {isLoading && !error && (
          <div className="absolute inset-0 z-50 bg-white">
            <HRMLoader />
          </div>
        )}

        {/* 2. Error State */}
        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center h-full text-red-600">
            <AlertCircle className="h-10 w-10 text-red-600" />
            <p className="font-bold text-lg mt-2">
              HRM Dashboard Failed to Load
            </p>
            <p className="text-sm text-center mt-1 max-w-md">{error}</p>
          </div>
        )}

        {/* 3. Success State (Iframe) */}
        {hrmUrl && (
          <iframe
            src={hrmUrl}
            title="HRM Dashboard"
            className="w-full h-full border-0"
            // When the iframe finishes loading, hide the loader
            onLoad={() => setIsLoading(false)}
            style={{
              display: "block",
            }}
            allow="fullscreen; geolocation"
          />
        )}

        {/* 4. Fallback if no URL and no Loading and no Error (Shouldn't happen) */}
        {!isLoading && !error && !hrmUrl && (
          <div className="text-center text-gray-500 p-10 m-auto">
            <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm">No HRM Dashboard URL available.</p>
          </div>
        )}

      </div>
    </Layout>
  );
}

