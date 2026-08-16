import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ModuleKey, ModulePermissions } from "@/contexts/StudioContext";

const MODULES: ModuleKey[] = [
  "customers",
  "attendance",
  "gallery",
  "classes",
  "insights",
  "payments",
  "offers",
  "renewals",
  "settings",
];

const NAV_LABELS: Record<ModuleKey, string> = {
  customers: "Members",
  attendance: "Attendance",
  gallery: "My Gallery",
  classes: "Classes",
  insights: "Insights",
  payments: "Payments",
  offers: "Offers",
  renewals: "Renewals",
  settings: "Settings",
};

const none = () => Object.fromEntries(MODULES.map((m) => [m, false])) as ModulePermissions;
const all = () => Object.fromEntries(MODULES.map((m) => [m, true])) as ModulePermissions;

const studio = {
  isOwner: true,
  ownerId: "owner-1",
  loading: false,
  permissions: all(),
};

vi.mock("@/contexts/StudioContext", async (orig) => {
  const actual = await orig<typeof import("@/contexts/StudioContext")>();
  return { ...actual, useStudio: () => studio };
});
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", email: "a@b.c" }, signOut: vi.fn(), loading: false }),
}));
vi.mock("@/hooks/useWallpaper", () => ({ useWallpaper: () => ({ mode: "none", image: null, color: null }) }));
vi.mock("@/components/SupportChatWidget", () => ({ default: () => null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
    }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

import PermissionGuard from "@/components/PermissionGuard";
import AppLayout from "@/components/layout/AppLayout";

const setRole = (isOwner: boolean, permissions: ModulePermissions) => {
  studio.isOwner = isOwner;
  studio.permissions = permissions;
  studio.loading = false;
};

const renderGuard = (module: ModuleKey) =>
  render(
    <MemoryRouter>
      <PermissionGuard module={module}>
        <div>PAGE:{module}</div>
      </PermissionGuard>
    </MemoryRouter>,
  );

const renderLayout = () =>
  render(
    <MemoryRouter>
      <AppLayout>
        <div>content</div>
      </AppLayout>
    </MemoryRouter>,
  );

beforeEach(() => setRole(true, all()));

describe("route guards", () => {
  it.each(MODULES)("owner can access %s", (module) => {
    setRole(true, none());
    renderGuard(module);
    expect(screen.getByText(`PAGE:${module}`)).toBeInTheDocument();
  });

  it.each(MODULES)("staff without permission is blocked from %s", (module) => {
    setRole(false, none());
    renderGuard(module);
    expect(screen.queryByText(`PAGE:${module}`)).not.toBeInTheDocument();
    expect(screen.getByText(/don't have access to this section/i)).toBeInTheDocument();
  });

  it.each(MODULES)("staff with permission can access %s", (module) => {
    setRole(false, { ...none(), [module]: true });
    renderGuard(module);
    expect(screen.getByText(`PAGE:${module}`)).toBeInTheDocument();
  });

  it("renders nothing while permissions are still loading", () => {
    setRole(false, none());
    studio.loading = true;
    const { container } = renderGuard("payments");
    expect(container.textContent).toBe("");
  });
});

describe("navigation visibility", () => {
  it("owner sees every module in the nav", () => {
    setRole(true, none());
    renderLayout();
    MODULES.forEach((m) => {
      expect(screen.getAllByText(NAV_LABELS[m]).length).toBeGreaterThan(0);
    });
  });

  it("staff with no permissions sees no module links", () => {
    setRole(false, none());
    renderLayout();
    MODULES.forEach((m) => {
      expect(screen.queryByText(NAV_LABELS[m])).not.toBeInTheDocument();
    });
  });

  it.each(MODULES)("staff with only %s permission sees just that link", (module) => {
    setRole(false, { ...none(), [module]: true });
    renderLayout();
    MODULES.forEach((m) => {
      if (m === module) expect(screen.getAllByText(NAV_LABELS[m]).length).toBeGreaterThan(0);
      else expect(screen.queryByText(NAV_LABELS[m])).not.toBeInTheDocument();
    });
  });

  it("hides the owner-only Staff & Permissions link for staff", () => {
    setRole(false, all());
    renderLayout();
    expect(screen.queryByText(/Staff & Permissions/i)).not.toBeInTheDocument();
    setRole(true, all());
    renderLayout();
    expect(screen.getAllByText(/Staff & Permissions/i).length).toBeGreaterThan(0);
  });
});
