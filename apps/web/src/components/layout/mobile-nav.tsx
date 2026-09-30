import { AppSidebar } from '@/components/layout/app-sidebar';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useUiStore } from '@/stores/ui-store';

/**
 * Navigation drawer for narrow viewports.
 *
 * Desktop gets the permanent sidebar from the shell grid, so this component is
 * only mounted below `md` and is fully controlled by the UI store. There is no
 * trigger of its own — the header's menu button opens it — which avoids two
 * competing controls announcing the same action to assistive technology.
 */
export function MobileNav() {
  const isOpen = useUiStore((state) => state.isSidebarOpen);
  const closeSidebar = useUiStore((state) => state.closeSidebar);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeSidebar()}>
      <SheetContent side="left" className="w-72 p-0" aria-describedby={undefined}>
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <AppSidebar onNavigate={closeSidebar} className="border-r-0" />
      </SheetContent>
    </Sheet>
  );
}
