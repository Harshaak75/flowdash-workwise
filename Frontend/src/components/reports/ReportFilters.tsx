import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function ReportFilters({ onApply, loading, filters, setFilters }: {
    onApply: () => void;
    loading: boolean;
    filters: any;
    setFilters: (f: any) => void;
}) {
    return (
        <div className="flex flex-row gap-4 items-end bg-card p-4 rounded-lg border shadow-sm w-auto">
            <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">From</label>
                <Input
                    type="date"
                    value={filters.from || ""}
                    onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                    className="w-[140px]"
                />
            </div>

            <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">To</label>
                <Input
                    type="date"
                    value={filters.to || ""}
                    onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                    className="w-[140px]"
                />
            </div>

            <Button
                onClick={onApply}
                disabled={loading}
                className="w-auto"
            >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Apply
            </Button>
        </div>
    );
}
