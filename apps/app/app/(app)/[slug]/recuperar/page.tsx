import { redirect } from 'next/navigation';

interface RecuperarPageProps {
  params: { slug: string };
}

export default function RecuperarPage({ params }: RecuperarPageProps) {
  redirect(`/${params.slug}/clientes`);
}
