import { redirect } from 'next/navigation';

interface NexoraBatchPageProps {
  params: { slug: string };
}

export default function NexoraBatchPage({ params }: NexoraBatchPageProps) {
  redirect(`/${params.slug}/clientes`);
}
