import axios from "axios";

const API = import.meta.env.VITE_API_BASE_URL;
const authHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
});

export const ReportsAPI = {
    me: () => axios.get(`${API}/auth/me`, { headers: authHeader() }),

    summary: () =>
        axios.get(`${API}/reports/reports/summary`, {
            headers: authHeader(),
        }),

    list: (params?: any) =>
        axios.get(`${API}/reports/reports`, {
            headers: authHeader(),
            params,
        }),

    generate: (payload: any) =>
        axios.post(`${API}/reports/reports/generate`, payload, {
            headers: authHeader(),
        }),

    teamPdf: (reportId: string) =>
        axios.get(`${API}/reports/analytics/${reportId}/team/pdf`, {
            headers: authHeader(),
        }),

    employeePdf: (reportId: string, userId: string) =>
        axios.get(`${API}/reports/download/${reportId}/employee/${userId}/pdf`, {
            headers: authHeader(),
        }),
};
