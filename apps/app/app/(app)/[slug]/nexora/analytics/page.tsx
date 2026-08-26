import { redirect } from 'next/navigation';

interface NexoraAnalyticsPageProps {
  params: { slug: string };
}

export default function NexoraAnalyticsPage({ params }: NexoraAnalyticsPageProps) {
  redirect(`/${params.slug}/clientes`);
}
