export declare function kcCreateUser({ email, firstName, lastName, tempPassword, }: {
    email: string;
    firstName?: string;
    lastName?: string;
    tempPassword?: string;
}): Promise<any>;
export declare function kcAssignRealmRole(userId: string, roleName: "MANAGER" | "OPERATOR"): Promise<void>;
//# sourceMappingURL=kc-users.d.ts.map