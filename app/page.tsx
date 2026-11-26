"use client";
import { withBasePath } from "@/lib/basePath";
import { LoginPage } from "@userin/auth-kit";


export default function HomePage() {
  return (
    <LoginPage
      apiUrl={withBasePath("/api/auth/login")}
      initialRedirectUrl={"/contact-records"}
      onSuccess={(user) => {
        console.log("Auth kit login succeeded:", user.username);
      }}
    />
  );
}
