import { createContext, useContext } from "react";

// Lets any page say "conversations changed" so the sidebar's recent list refreshes.
export const SidebarContext = createContext({ refreshSidebar: () => {} });
export const useSidebar = () => useContext(SidebarContext);
