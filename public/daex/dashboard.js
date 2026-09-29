const SUPABASE_URL = "https://ekmzeqnnktdwvzxacbix.supabase.co";
const SUPABASE_KEY = "sb_publishable_jeWoJ4G9UXN6ucS3WkZVzA_ytTEzuJz";
const STORAGE_KEY = "daex-auth";

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

async function validUser() {
  const session = readSession();
  if (!session?.access_token) return false;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) return false;
  const user = await response.json();
  return user?.email?.toLowerCase() === "caixadaex@cahk.app";
}

(async () => {
  const ok = await validUser();

  if (!ok) {
    localStorage.removeItem(STORAGE_KEY);
    location.replace("./");
    return;
  }

  document.querySelector("#logout").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    location.replace("./");
  });
})();
