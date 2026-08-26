import { redirect } from 'next/navigation';

interface PipelinePageProps {
  params: { slug: string };
}

export default function PipelinePage({ params }: PipelinePageProps) {
  redirect(`/${params.slug}/clientes`);
}
