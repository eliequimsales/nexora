import { redirect } from 'next/navigation';

interface OrganizationPageProps {
  params: { slug: string };
}

export default function OrganizationPage({ params }: OrganizationPageProps) {
  redirect(`/${params.slug}/inicio`);
}
