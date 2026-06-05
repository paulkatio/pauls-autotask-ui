import type { Role } from "@/lib/auth/session";

// Cookie-Name für die Mock-Auswahl (Dev). Wert = userName.
export const MOCK_COOKIE = "mock_user";

// Mock-User für die lokale Entwicklung (AUTH_MODE=mock). Mapping-Schlüssel ist der
// `userName` (eindeutig). `autotaskResourceId` zeigt auf eine Autotask-Resource und
// ist nötig, damit „Meine Tickets" greift – beim Anschluss an einen anderen Mandanten
// hier die passenden Resource-IDs eintragen. Rollen sind frei gewählt, sodass je ein
// agent, ein teamleiter und ein admin zum Testen existieren.
export interface MockUser {
  userName: string;
  displayName: string;
  email: string;
  roles: Role[];
  autotaskResourceId: number;
}

export const mockUsers: MockUser[] = [
  {
    userName: "demo.agent",
    displayName: "Demo Agent",
    email: "agent@example.com",
    roles: ["agent"],
    autotaskResourceId: 29682903,
  },
  {
    userName: "demo.lead",
    displayName: "Demo Teamlead",
    email: "teamlead@example.com",
    roles: ["agent", "teamleiter"],
    autotaskResourceId: 29682886,
  },
  {
    userName: "demo.admin",
    displayName: "Demo Admin",
    email: "admin@example.com",
    roles: ["admin"],
    autotaskResourceId: 4,
  },
];

export function findMockUser(userName: string | undefined): MockUser | undefined {
  if (!userName) return undefined;
  return mockUsers.find((u) => u.userName === userName);
}
