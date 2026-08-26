import { redirect } from 'next/navigation';

interface WorkflowsPageProps {
  params: { slug: string };
}

export default function WorkflowsPage({ params }: WorkflowsPageProps) {
  redirect(`/${params.slug}/clientes`);
}
