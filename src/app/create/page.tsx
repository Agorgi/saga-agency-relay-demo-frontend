import { permanentRedirect } from "next/navigation";

export default function CreateRedirectPage() {
  permanentRedirect("/?intent=host");
}
