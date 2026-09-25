import { createClient } from "@/lib/supabase/server";
import AccountMenu from "@/components/AccountMenu";

export default async function AccountMenuServer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;
  return <AccountMenu email={user.email} />;
}
