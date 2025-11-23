import axios from "axios";
const base = process.env.KEYCLOAK_BASE_URL!;
const realm = process.env.KEYCLOAK_REALM!;
const clientId = process.env.KEYCLOAK_PROVISIONER_CLIENT_ID!;
const clientSecret = process.env.KEYCLOAK_PROVISIONER_CLIENT_SECRET!;

export async function getProvisionerToken() {
  const url = `${base}/realms/${realm}/protocol/openid-connect/token`;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const { data } = await axios.post(url, body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  return data.access_token as string;
}
