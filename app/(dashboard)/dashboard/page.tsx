import { redirect } from "next/navigation";

// No distinct "dashboard home" frame exists in Figma — "My Books" is the designed default view.
export default function DashboardHomePage() {
  redirect("/dashboard/books");
}
