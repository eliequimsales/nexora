import { Sidebar } from '@/components/shell/Sidebar';
import { TopBar } from '@/components/shell/TopBar';
import { SlugGuard } from '@/components/shell/SlugGuard';
import { CopilotButton } from '@/components/modules/copilot/CopilotButton';
import { ErrorBoundary } from '@/components/shell/ErrorBoundary';
import { MobileSidebarProvider } from '@/components/shell/MobileSidebarContext';

interface OrgLayoutProps {
  children: React.ReactNode;
  params: { slug: string };
}

export default function OrgLayout({ children, params }: OrgLayoutProps) {
  return (
    <MobileSidebarProvider>
      <div className="min-h-screen bg-brand-bg">
        <SlugGuard slug={params.slug} />
        <Sidebar />
        <TopBar />
        <main
          className="min-h-screen"
          style={{
            marginLeft: 'var(--sidebar-width)',
            paddingTop: 'var(--header-height)',
          }}
        >
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
        <CopilotButton />
      </div>
    </MobileSidebarProvider>
  );
}
