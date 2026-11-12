import { getRepository } from '@/lib/db';
import { HomeClient } from '@/components/HomeClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const settings = await getRepository().getSettings();
  return <HomeClient initialSettings={settings} />;
}

