import { useMutation } from "@tanstack/react-query";
import { api } from "../api";

export default function ResetPassword({ userId, name }: { userId: string; name: string }) {
  const reset = useMutation({
    mutationFn: (password: string) =>
      api(`/users/${userId}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password }),
      }),
    onSuccess: () => window.alert(`Geslo za ${name} je spremenjeno.`),
    onError: (error: Error) => window.alert(error.message),
  });

  function ask() {
    const password = window.prompt(`Novo geslo za ${name} (vsaj 8 znakov)`);
    if (password) reset.mutate(password);
  }

  return (
    <button type="button" className="btn-mini neutral" disabled={reset.isPending} onClick={ask}>
      Geslo
    </button>
  );
}
