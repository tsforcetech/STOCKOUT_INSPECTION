import type { Icon } from "@phosphor-icons/react";
import { ClipboardTextIcon, HouseIcon, NotePencilIcon, ScalesIcon, UserCheckIcon, UserIcon } from "@phosphor-icons/react";
import type { PermissionRequirement } from "@/lib/permissions/permissions";
import { PERMISSIONS as P } from "@/api/types/user-organization";

export interface NavItem {
  label: string;
  /** Short label for the phone bottom tab bar. */
  short?: string;
  to: string;
  icon: Icon;
  /** Hidden when the signed-in user lacks this permission. */
  permission?: PermissionRequirement;
  /** Shown in the phone bottom tab bar. */
  tab?: boolean;
  /** Kept for compatibility with the shared sidebar; the inspector portal has no "Soon" modules. */
  unavailable?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

/** The inspector portal shows only inspection work: no catalog, sellers, team or settings. */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "work",
    label: "Inspection work",
    items: [
      { label: "Dashboard", short: "Home", to: "/", icon: HouseIcon, tab: true },
      { label: "My inspections", short: "My work", to: "/my", icon: UserCheckIcon, permission: P.INSPECTIONS_VIEW, tab: true },
      { label: "All inspections", short: "All", to: "/inspections", icon: ClipboardTextIcon, permission: P.INSPECTIONS_VIEW, tab: true },
      { label: "Listing corrections", short: "Corrections", to: "/corrections", icon: NotePencilIcon, permission: P.INSPECTIONS_VIEW, tab: true },
      { label: "Inspection disputes", short: "Disputes", to: "/disputes", icon: ScalesIcon, permission: P.INSPECTIONS_VIEW },
    ],
  },
  {
    id: "account",
    label: "Account",
    items: [{ label: "My profile", short: "Profile", to: "/account", icon: UserIcon, tab: true }],
  },
];

export const SHOW_UNAVAILABLE_MODULES = false;

/** Permissions that make someone an inspection user. Anyone without one of these sees the "inspector access only" screen. */
export const INSPECTOR_ACCESS = { anyOf: [P.INSPECTIONS_VIEW, P.INSPECTIONS_PERFORM, P.INSPECTIONS_ASSIGN, P.INSPECTIONS_OVERRIDE] } as const;
