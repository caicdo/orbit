import type { ComponentType } from "react";
import HomePage from "./HomePage";
import TasksPage from "./TasksPage";
import MyDayPage from "./MyDayPage";
import ListsPage from "./ListsPage";
import SettingsPage from "./SettingsPage";

/** What the toolbar's primary button does on this page. */
export type PrimaryAction = "new-task" | "new-list" | "none";

export interface PageDef {
  /** stable id — also the key stored in nav prefs; never rename after release */
  id: string;
  label: string;
  /** Phosphor icon class, e.g. "ph ph-house" (https://phosphoricons.com) */
  icon: string;
  defaultPinned: boolean;
  primaryAction: PrimaryAction;
  component: ComponentType;
}

/**
 * THE page list. To add a page:
 *   1. create `src/pages/MyThingPage.tsx` exporting a default component
 *   2. add one entry here
 * The sidebar, the router, the toolbar button and nav prefs all follow.
 */
export const PAGES: PageDef[] = [
  { id: "home", label: "Home", icon: "ph ph-house", defaultPinned: true, primaryAction: "new-task", component: HomePage },
  { id: "tasks", label: "Tasks", icon: "ph ph-check-square-offset", defaultPinned: true, primaryAction: "new-task", component: TasksPage },
  { id: "myday", label: "My day", icon: "ph ph-sun", defaultPinned: true, primaryAction: "new-task", component: MyDayPage },
  { id: "lists", label: "Lists", icon: "ph ph-folders", defaultPinned: false, primaryAction: "new-list", component: ListsPage },
  { id: "settings", label: "Settings", icon: "ph ph-gear-six", defaultPinned: false, primaryAction: "none", component: SettingsPage },
];

export const pageById = (id: string): PageDef | undefined => PAGES.find((p) => p.id === id);
export const DEFAULT_PAGE = PAGES[0].id;
