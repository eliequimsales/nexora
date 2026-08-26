import { redirect } from 'next/navigation';

interface LeadsPageProps {
  params: { slug: string };
}

export default function LeadsPage({ params }: LeadsPageProps) {
  redirect(`/${params.slug}/clientes`);
}
