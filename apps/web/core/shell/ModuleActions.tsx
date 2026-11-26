'use client';

/**
 * ModuleActions — the contract between the universal shell (Header/Footer)
 * and individual modules.
 *
 * A module mounted on its route can register:
 *  - headerTitle:   ReactNode rendered beside the site logo
 *  - headerActions: ReactNode rendered inside the shell Header (left of global controls)
 *  - footerNote:    short ReactNode rendered in the shell Footer
 *
 * Registration is automatically cleaned up on unmount, so a crashed or
 * unmounted module can never leave stale buttons in the shell.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';

interface ModuleUI {
  moduleId: string;
  headerTitle?: ReactNode;
  headerActions?: ReactNode;
  footerNote?: ReactNode;
}

interface ModuleActionsContextType {
  current: ModuleUI | null;
  register: (ui: ModuleUI) => void;
  unregister: (moduleId: string) => void;
}

const ModuleActionsContext = createContext<ModuleActionsContextType | null>(null);

export const ModuleActionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [current, setCurrent] = useState<ModuleUI | null>(null);

  const register = useCallback((ui: ModuleUI) => setCurrent(ui), []);
  const unregister = useCallback(
    (moduleId: string) =>
      setCurrent((prev) => (prev?.moduleId === moduleId ? null : prev)),
    []
  );

  return (
    <ModuleActionsContext.Provider value={{ current, register, unregister }}>
      {children}
    </ModuleActionsContext.Provider>
  );
};

export const useModuleActionsHost = () => {
  const ctx = useContext(ModuleActionsContext);
  if (!ctx) throw new Error('useModuleActionsHost must be used within ModuleActionsProvider');
  return ctx;
};

/**
 * Hook for modules: register UI into the shell for the lifetime of the component.
 *
 *   useModuleActions('lathe', { headerActions: <MyButtons />, footerNote: <Note /> });
 */
export const useModuleActions = (
  moduleId: string,
  ui: Omit<ModuleUI, 'moduleId'>,
  deps: any[] = []
) => {
  const { register, unregister } = useModuleActionsHost();

  useEffect(() => {
    register({ moduleId, ...ui });
    return () => unregister(moduleId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};
