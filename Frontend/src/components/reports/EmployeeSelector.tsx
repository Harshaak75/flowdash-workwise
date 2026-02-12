import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmployeesAPI } from "@/api/employees";

export function EmployeeSelector({ onSelect }: any) {
    const [search, setSearch] = useState("");
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    async function load() {
        setLoading(true);
        const res = await EmployeesAPI.search(search);
        setEmployees(res.data);
        setLoading(false);
    }

    useEffect(() => {
        if (search.trim()) {
            load();
        } else {
            setEmployees([]);
        }
    }, [search]);

    const managers = employees.filter(e => e.role === 'MANAGER');
    const operators = employees.filter(e => e.role !== 'MANAGER');

    return (
        <div className="relative w-64">
            <Input
                placeholder="Search employee..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
            />

            {(search.trim().length > 0) && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                    {loading && <p className="text-xs p-2 text-muted-foreground">Searching...</p>}

                    {!loading && employees.length === 0 && (
                        <p className="text-xs p-2 text-muted-foreground">No results found.</p>
                    )}

                    {managers.length > 0 && (
                        <div className="p-1">
                            <h4 className="text-xs font-semibold text-muted-foreground px-2 py-1 bg-muted/50 rounded-sm">Managers</h4>
                            {managers.map((e) => (
                                <Button
                                    key={e.id}
                                    variant="ghost"
                                    className="w-full justify-start text-sm h-8 px-2"
                                    onClick={() => {
                                        onSelect(e);
                                        setSearch(""); // Clear search on select
                                        setEmployees([]);
                                    }}
                                >
                                    {e.email}
                                </Button>
                            ))}
                        </div>
                    )}

                    {operators.length > 0 && (
                        <div className="p-1">
                            <h4 className="text-xs font-semibold text-muted-foreground px-2 py-1 bg-muted/50 rounded-sm">Employees</h4>
                            {operators.map((e) => (
                                <Button
                                    key={e.id}
                                    variant="ghost"
                                    className="w-full justify-start text-sm h-8 px-2"
                                    onClick={() => {
                                        onSelect(e);
                                        setSearch(""); // Clear search on select
                                        setEmployees([]);
                                    }}
                                >
                                    {e.email}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
