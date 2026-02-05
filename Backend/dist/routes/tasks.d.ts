declare const router: import("express-serve-static-core").Router;
declare global {
    interface Date {
        getWeekNumber(): number;
    }
}
export default router;
//# sourceMappingURL=tasks.d.ts.map