import { redirect } from 'next/navigation';

interface AnalyticsPageProps {
  params: { slug: string };
}

export default function AnalyticsPage({ params }: AnalyticsPageProps) {
  redirect(`/${params.slug}/clientes`);
}
