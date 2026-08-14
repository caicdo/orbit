import { createContext, useContext } from "react";

/** Lets a page switch tabs without owning routing itself — AppShell provides
 *  the real implementation; pages just call useNav()("tasks"). */
const NavContext = createContext<(id: string) => void>(() => {});

export const NavProvider = NavContext.Provider;

export const useNav = (): ((id: string) => void) => useContext(NavContext);
