import axios from "axios";
import { getProvisionerToken } from "./kc-admin";

const base = process.env.KEYCLOAK_BASE_URL!;
const realm = process.env.KEYCLOAK_REALM!;

export async function kcCreateUser({
  email,
  firstName,
  lastName,
  tempPassword,
}: {
  email: string;
  firstName?: string;
  lastName?: string;
  tempPassword?: string;
}) {
  const token = await getProvisionerToken();

  // 1️⃣ Create user
  await axios.post(
    `${base}/admin/realms/${realm}/users`,
    {
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
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  // 2️⃣ Get user ID
  const { data: users } = await axios.get(
    `${base}/admin/realms/${realm}/users`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params: { username: email },
    }
  );

  const user = users[0];
  return user; // includes id, username, etc.
}

export async function kcAssignRealmRole(userId: string, roleName: "MANAGER" | "OPERATOR") {
  const token = await getProvisionerToken();

  // get role info
  const { data: role } = await axios.get(
    `${base}/admin/realms/${realm}/roles/${roleName}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  // assign
  await axios.post(
    `${base}/admin/realms/${realm}/users/${userId}/role-mappings/realm`,
    [role],
    { headers: { Authorization: `Bearer ${token}` } }
  );
}
