import { redirect } from "next/navigation";

// Signed-out visitors are sent to /login by the proxy before reaching this.
export default function Home() {
  redirect("/brands");
}
