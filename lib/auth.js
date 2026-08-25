export const USERS = [
  {
    id: "admin-1",
    email: "admin1@heipl.com",
    password: "admin101",
    name: "Admin One",
    role: "admin",
  },
  {
    id: "admin-2",
    email: "admin2@heipl.com",
    password: "admin202",
    name: "Admin Two",
    role: "admin",
  },
  {
    id: "admin-3",
    email: "admin3@heipl.com",
    password: "admin303",
    name: "Admin Three",
    role: "admin",
  },
  {
    id: "admin-4",
    email: "admin4@heipl.com",
    password: "admin404",
    name: "Admin Four",
    role: "admin",
  },
  {
    id: "agent-1",
    email: "agent1@heipl.com",
    password: "agent115",
    name: "Field Agent 1",
    role: "agent",
  },
  {
    id: "agent-2",
    email: "agent2@heipl.com",
    password: "agent226",
    name: "Field Agent 2",
    role: "agent",
  },
  {
    id: "agent-3",
    email: "agent3@heipl.com",
    password: "agent337",
    name: "Field Agent 3",
    role: "agent",
  },
  {
    id: "agent-4",
    email: "agent4@heipl.com",
    password: "agent448",
    name: "Field Agent 4",
    role: "agent",
  },
  {
    id: "agent-5",
    email: "agent5@heipl.com",
    password: "agent559",
    name: "Field Agent 5",
    role: "agent",
  },
  {
    id: "agent-6",
    email: "agent6@heipl.com",
    password: "agent670",
    name: "Field Agent 6",
    role: "agent",
  },
  {
    id: "agent-7",
    email: "agent7@heipl.com",
    password: "agent781",
    name: "Field Agent 7",
    role: "agent",
  },
  {
    id: "agent-8",
    email: "agent8@heipl.com",
    password: "agent892",
    name: "Field Agent 8",
    role: "agent",
  },
  {
    id: "agent-9",
    email: "agent9@heipl.com",
    password: "agent903",
    name: "Field Agent 9",
    role: "agent",
  },
  {
    id: "agent-10",
    email: "agent10@heipl.com",
    password: "agent814",
    name: "Field Agent 10",
    role: "agent",
  },
];

export function authenticate(email, password) {
  const user = USERS.find(
    (u) =>
      u.email.toLowerCase() === email.toLowerCase().trim() &&
      u.password === password,
  );
  if (!user) return null;
  const { password: _pw, ...safeUser } = user;
  return safeUser;
}

export function getSession() {
  if (typeof window === "undefined") return null;
  try {
    const data = localStorage.getItem("heipl_session");
    if (!data) return null;
    const session = JSON.parse(data);
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - session.loginTime > thirtyDays) {
      localStorage.removeItem("heipl_session");
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function setSession(user) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    "heipl_session",
    JSON.stringify({
      ...user,
      loginTime: Date.now(),
    }),
  );
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("heipl_session");
}

export function isAdmin(user) {
  return user && user.role === "admin";
}

export function filterRecordsForUser(records, user, admin) {
  if (admin) return records;
  if (!user) return [];
  return records.filter((record) => record.agentEmployeeId === user.id);
}
