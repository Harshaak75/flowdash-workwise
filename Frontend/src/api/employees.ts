import axios from "axios";

const API = import.meta.env.VITE_API_BASE_URL;
const authHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
});

export const EmployeesAPI = {
    search: (search: string) =>
        axios.get(`${API}/reports/search`, {
            headers: authHeader(),
            params: { search },
        }),
};
