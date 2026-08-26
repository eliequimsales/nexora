import { redirect } from 'next/navigation';

interface ProposalsPageProps {
  params: { slug: string };
}

export default function ProposalsPage({ params }: ProposalsPageProps) {
  redirect(`/${params.slug}/clientes`);
}
