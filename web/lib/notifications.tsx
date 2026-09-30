"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

// Modèle unifié des notifications de l'app : succès, erreur, info.
// Chaque notification a un identifiant croissant, un texte et un ton.
// autoClose = false laisse la notification en place jusqu'à un clic
// explicite (utile pour les erreurs importantes qu'on ne veut pas
// louper).
export type NotifTon = "success" | "error" | "info";
export type Notification = {
  id: number;
  ton: NotifTon;
  texte: string;
  detail?: string;
  autoClose: boolean;
  vu: boolean;
  quand: Date;
};

type CtxValeur = {
  liste: Notification[];
  notifier: (n: Omit<Notification, "id" | "vu" | "quand">) => number;
  fermer: (id: number) => void;
  toutFermer: () => void;
  marquerToutVu: () => void;
  nonVus: number;
};

const Ctx = createContext<CtxValeur | null>(null);

let compteur = 1;

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [liste, setListe] = useState<Notification[]>([]);

  const notifier = useCallback(
    (n: Omit<Notification, "id" | "vu" | "quand">) => {
      const id = compteur++;
      setListe((prev) => [
        { ...n, id, vu: false, quand: new Date() },
        ...prev,
      ]);
      return id;
    },
    [],
  );

  const fermer = useCallback((id: number) => {
    setListe((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const toutFermer = useCallback(() => setListe([]), []);

  const marquerToutVu = useCallback(() => {
    setListe((prev) => prev.map((n) => ({ ...n, vu: true })));
  }, []);

  const nonVus = liste.filter((n) => !n.vu).length;

  const valeur = useMemo<CtxValeur>(
    () => ({ liste, notifier, fermer, toutFermer, marquerToutVu, nonVus }),
    [liste, notifier, fermer, toutFermer, marquerToutVu, nonVus],
  );

  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

// Hook principal : renvoie une fonction concise pour notifier.
// Utilisation typique :
//   const { notifier } = useNotifications();
//   notifier({ ton: "error", texte: "Échec de la sauvegarde." });
export function useNotifications(): CtxValeur {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error(
      "useNotifications() doit être appelé sous <NotificationProvider>.",
    );
  }
  return v;
}

// Helper : version « fire and forget » sûre à appeler côté client
// pur (composants sans provider dans les tests par exemple).
export function useNotifierSafe():
  | ((n: Omit<Notification, "id" | "vu" | "quand">) => void)
  | null {
  const v = useContext(Ctx);
  return v ? v.notifier : null;
}
