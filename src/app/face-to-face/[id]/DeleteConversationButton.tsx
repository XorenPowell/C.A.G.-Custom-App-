"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGlobalTransition } from "@/lib/useGlobalTransition";
import { deleteConversation } from "@/app/actions/face-to-face";

export default function DeleteConversationButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useGlobalTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mb-16 mt-6 border-t border-[var(--color-line)] pt-4">
      <button
        type="button"
        className="btn btn-danger"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Delete this conversation permanently?")) return;
          start(async () => {
            setError(null);
            const res = await deleteConversation(id);
            if (!res.ok) {
              setError(res.error ?? "Delete failed.");
              return;
            }
            router.push("/face-to-face");
            router.refresh();
          });
        }}
      >
        {pending ? "Deleting…" : "Delete conversation"}
      </button>
      {error && <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
