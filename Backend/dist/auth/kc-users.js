"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.kcCreateUser = kcCreateUser;
exports.kcAssignRealmRole = kcAssignRealmRole;
const axios_1 = __importDefault(require("axios"));
const kc_admin_1 = require("./kc-admin");
const base = process.env.KEYCLOAK_BASE_URL;
const realm = process.env.KEYCLOAK_REALM;
async function kcCreateUser({ email, firstName, lastName, tempPassword, }) {
    const token = await (0, kc_admin_1.getProvisionerToken)();
    // 1️⃣ Create user
    await axios_1.default.post(`${base}/admin/realms/${realm}/users`, {
        username: email,
        email,
        enabled: true,
        firstName,
        lastName,
        credentials: tempPassword
            ? [
                {
                    type: "password",
                    value: tempPassword,
                    temporary: true,
                },
            ]
            : undefined,
    }, { headers: { Authorization: `Bearer ${token}` } });
    // 2️⃣ Get user ID
    const { data: users } = await axios_1.default.get(`${base}/admin/realms/${realm}/users`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { username: email },
    });
    const user = users[0];
    return user; // includes id, username, etc.
}
async function kcAssignRealmRole(userId, roleName) {
    const token = await (0, kc_admin_1.getProvisionerToken)();
    // get role info
    const { data: role } = await axios_1.default.get(`${base}/admin/realms/${realm}/roles/${roleName}`, { headers: { Authorization: `Bearer ${token}` } });
    // assign
    await axios_1.default.post(`${base}/admin/realms/${realm}/users/${userId}/role-mappings/realm`, [role], { headers: { Authorization: `Bearer ${token}` } });
}
//# sourceMappingURL=kc-users.js.map