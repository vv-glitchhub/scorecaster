import LoginClient from "./LoginClient";
import { safeNextPath } from "../../lib/auth-navigation.mjs";

export const metadata = { title: "Kirjaudu" };

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  return <LoginClient next={safeNextPath(params?.next)} confirmationError={Boolean(params?.error)} />;
}
