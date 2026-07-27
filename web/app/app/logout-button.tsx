"use client";

export default function LogoutButton() {
  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-full border border-hairline px-4 py-1.5 text-sm font-medium text-ink transition hover:bg-surface"
    >
      Se déconnecter
    </button>
  );
}
