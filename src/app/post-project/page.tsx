import { permanentRedirect } from "next/navigation";

export default function PostProjectRedirectPage() {
  permanentRedirect("/?intent=host");
}
