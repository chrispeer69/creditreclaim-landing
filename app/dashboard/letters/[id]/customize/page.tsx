import { notFound } from 'next/navigation';
import { fetchLetterById } from '@/lib/letters';
import CustomizeClient from './CustomizeClient';

// Editor is per-user state — never prerender.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Customize Letter · CreditReclaim',
};

export default async function CustomizePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const { letter, error } = await fetchLetterById(id);
  if (error || !letter) notFound();

  return (
    <CustomizeClient
      letterId={letter.id}
      letterNumber={letter.number}
      letterTitle={letter.title}
      letterStage={letter.stage}
      letterCategory={letter.category}
      masterTemplateBody={letter.template_body}
    />
  );
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
