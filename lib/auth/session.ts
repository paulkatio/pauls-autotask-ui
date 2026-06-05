// Die EINZIGE Repräsentation des angemeldeten Users in der App.
// Server-Komponenten und Route-Handler lesen ausschließlich SessionUser –
// niemand greift direkt auf "den Login" zu (siehe CLAUDE.md §4).
// Die Felder sind exakt so geschnitten, dass Entra ID sie später 1:1 füllen kann.

export type Role = "agent" | "teamleiter" | "admin";

export interface SessionUser {
  id: string; // stabile User-ID (Mock: userName; Entra: oid)
  email: string; // UPN / Mail
  displayName: string;
  roles: Role[]; // Mock: frei gewählt; Entra: aus groups/roles-Claims
  autotaskResourceId: number; // Mapping auf Autotask-Resource, nötig für "Meine Tickets"
}
