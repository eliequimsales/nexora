import { redirect } from 'next/navigation';

interface NexoraResponsesPageProps {
  params: { slug: string };
}

export default function NexoraResponsesPage({ params }: NexoraResponsesPageProps) {
  redirect(`/${params.slug}/clientes`);
}
